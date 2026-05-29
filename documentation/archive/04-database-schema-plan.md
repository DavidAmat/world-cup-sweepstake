# 04 — Esquema de base de datos

> Referencia del índice: `context/plan/01-plan.md` §7 → Hito 04.
>
> Depende de: hito 03 (Supabase local + producción enlazada,
> extensiones `pgcrypto` y `citext` activadas).

---

## 1. Goal

Definir todo el modelo de datos del proyecto en migraciones SQL
versionadas, listo para que los hitos siguientes (06+) lo pueblen
con seeds y empiecen a leer/escribir desde la app.

Por hito quedará:

- 16 tablas creadas con sus PKs, FKs, checks e índices.
- Funciones helper para RLS (`is_admin()`, `is_fixture_locked()`).
- Políticas RLS por tabla siguiendo la estrategia descrita en §4.
- `database.types.ts` regenerado y compilando.
- Migraciones aplicadas a local **y** a producción.

---

## 2. Decisiones cerradas para este hito

- **5 migraciones** además de la de extensiones (ya aplicada). Cada
  migración crea las tablas de un grupo lógico, habilita RLS sobre
  ellas y define sus policies + índices. Auto-contenidas y
  reviewables.
- **Sin enums Postgres** — texto con `check` en su lugar. Más fácil
  de extender sin `ALTER TYPE`.
- **Strategy: row-level security siempre on**. Cualquier tabla nueva
  arranca con RLS habilitada antes de exponerse vía API.
- **`tournament_id` repetido** en todas las tablas de dominio
  (decisión cerrada en el PID, vuelve a aplicarse aquí).
- **FKs:** cascade donde la limpieza de un torneo debe arrastrar
  datos derivados; restrict donde un borrado accidental sería un
  bug; set null donde la integridad puede sobrevivir a la
  desaparición de la entidad referenciada.
- **`auth.uid()` envuelto en `(select auth.uid())`** dentro de las
  policies, recomendación de Supabase para que Postgres cachee el
  valor por query.
- **Helpers en `public.*` con `security definer`** para evitar bucles
  recursivos en policies que consultan `profiles`.
- **Idempotencia de imports**: las tablas que se cargan desde JSONs
  (teams, players, fixtures) llevan un `external_id` con `unique
  (tournament_id, external_id)` para hacer upsert sin duplicar.
- **`prediction_scores` y `leaderboard_snapshots` son derivadas**:
  se borran y regeneran. El admin client (service role) será el
  único que escribe; la RLS para `insert/update/delete` para
  usuarios normales es deny.
- **No definimos triggers en este hito** salvo `updated_at` automático
  (función + trigger genérico). El trigger que crea `profiles` al
  registrarse un usuario va en el hito 05.
- **`citext` para slugs y códigos**: el matching futuro contra seeds
  importados se beneficia de la insensibilidad a mayúsculas. Se usa
  en `tournaments.slug`, `teams.code`, `stages.code`, `rounds.code`.
- **Naming**: tablas en snake_case plural (`tournaments`,
  `match_predictions`). Columnas en snake_case singular.

---

## 3. Plan de migraciones

| # | Fichero (timestamp variable)                                | Contenido |
|---|--------------------------------------------------------------|-----------|
| 1 | `…_enable_extensions.sql` (ya aplicada en hito 03)           | `pgcrypto`, `citext` |
| 2 | `…_tournaments_profiles_terms.sql`                           | `tournaments`, `profiles`, `terms_acceptances` + helpers `is_admin`, `set_updated_at` + RLS + índices |
| 3 | `…_master_data.sql`                                          | `teams`, `players`, `stages`, `rounds` + RLS + índices |
| 4 | `…_fixtures_and_results.sql`                                 | `fixtures`, `match_results`, `match_goals`, `player_match_stats` + helper `is_fixture_locked` + RLS + índices |
| 5 | `…_predictions.sql`                                          | `initial_predictions`, `group_qualification_predictions`, `match_predictions` + RLS + índices |
| 6 | `…_scoring.sql`                                              | `scoring_rules`, `prediction_scores`, `leaderboard_snapshots` + RLS + índices |

Después de cada migración:

```bash
npm run db:reset       # reaplica todas las migraciones desde cero
npm run types:gen      # regenera src/lib/supabase/database.types.ts
npm run build          # asegura que la app sigue compilando
```

Al final del hito, una sola ejecución de `npm run db:push` aplica
las 5 nuevas migraciones a producción.

---

## 4. Estrategia de RLS

Tres roles funcionales:

- **`anon`**: usuarios no autenticados → casi nada visible
  (Public landing OK, todo lo demás no).
- **`authenticated`**: usuarios logueados → master data + sus propias
  predicciones + predicciones ajenas solo cuando el fixture está
  bloqueado + resultados confirmados + scores.
- **`service_role`** (el admin client server-side): bypass de RLS,
  sin restricciones.

Helpers (en migración 2):

```sql
-- Verifica si el usuario actual tiene rol admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'admin'
  )
$$;

-- Trigger genérico para mantener updated_at.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
```

Helper de fixtures (en migración 4):

```sql
create or replace function public.is_fixture_locked(p_fixture_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    now() >= (select kickoff_at - interval '24 hours' from public.fixtures where id = p_fixture_id),
    false
  )
$$;
```

Patrón general por tabla:

```sql
alter table public.<t> enable row level security;

-- master data (lectura para autenticados, escritura admin)
create policy "<t>_select_authenticated" on public.<t>
  for select to authenticated using (true);

create policy "<t>_admin_all" on public.<t>
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

Patrón para predicciones:

```sql
create policy "match_predictions_select_own_or_locked" on public.match_predictions
  for select to authenticated using (
    user_id = (select auth.uid())
    or public.is_fixture_locked(fixture_id)
  );

create policy "match_predictions_insert_own_unlocked" on public.match_predictions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not public.is_fixture_locked(fixture_id)
  );

create policy "match_predictions_update_own_unlocked" on public.match_predictions
  for update to authenticated
  using (user_id = (select auth.uid()) and not public.is_fixture_locked(fixture_id))
  with check (user_id = (select auth.uid()) and not public.is_fixture_locked(fixture_id));

create policy "match_predictions_delete_own_unlocked" on public.match_predictions
  for delete to authenticated
  using (user_id = (select auth.uid()) and not public.is_fixture_locked(fixture_id));

create policy "match_predictions_admin_all" on public.match_predictions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

(`profiles` lleva una variante: cualquier autenticado puede leer
todas las filas — necesario para mostrar nombres en leaderboards —
pero solo el dueño puede actualizar y nunca puede cambiar `role`).

---

## 5. Esqueletos de tablas (resumen)

> Las migraciones reales tendrán además `default now()` en
> `created_at/updated_at` y triggers de `set_updated_at`. Aquí solo
> reseñamos las columnas y constraints más importantes.

### Migración 2 — tournaments, profiles, terms_acceptances

```sql
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,                    -- 'wc_2022_test', 'wc_2026'
  name text not null,
  year integer not null,
  status text not null default 'draft'
    check (status in ('draft','active','completed','archived')),
  is_test boolean not null default false,
  predictions_open_until timestamptz,             -- null = derivar del primer fixture
  group_qualifiers_per_group int not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  initials text not null,
  role text not null default 'player'
    check (role in ('admin','player')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  rules_version integer not null,
  accepted_at timestamptz not null default now(),
  unique (tournament_id, user_id, rules_version)
);
```

RLS:
- `tournaments`: select auth, all admin.
- `profiles`: select auth (todos), update own (excepto `role`),
  insert solo via trigger en hito 05 / admin.
- `terms_acceptances`: select auth, insert own, no update/delete
  (auditoría); admin all.

### Migración 3 — master data (teams, players, stages, rounds)

```sql
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  external_id text,                                -- para upsert idempotente
  code citext not null,                            -- ESP, ARG, FRA
  canonical_name text not null,                    -- "Spain"
  display_name text not null,                      -- "España" (UI ES)
  aliases jsonb not null default '[]'::jsonb,
  group_code text,                                 -- A..H
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, code),
  unique (tournament_id, external_id)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  external_id text,
  canonical_name text not null,
  display_name text not null,
  aliases jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, external_id)
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  code citext not null,                            -- group_stage, round_of_16, ...
  name text not null,                              -- "Fase de grupos", ...
  sort_order int not null,
  score_multiplier numeric(4,2) not null default 1.00,
  unique (tournament_id, code)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage_id uuid not null references public.stages(id) on delete cascade,
  code citext not null,                            -- group_md1, r16, qf, ...
  name text not null,                              -- "Jornada 1", "Octavos", ...
  sort_order int not null,
  unique (tournament_id, code)
);
```

RLS para los cuatro: select auth, all admin.

Índices auxiliares:
- `players (team_id)`
- `rounds (tournament_id, sort_order)`

### Migración 4 — fixtures, match_results, match_goals, player_match_stats

```sql
create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage_id uuid not null references public.stages(id) on delete restrict,
  round_id uuid not null references public.rounds(id) on delete restrict,
  group_code text,
  home_team_id uuid references public.teams(id) on delete set null,
  away_team_id uuid references public.teams(id) on delete set null,
  home_placeholder text,                           -- "Winner Group A" en eliminatorias
  away_placeholder text,
  kickoff_at timestamptz not null,
  venue text,
  external_id text,
  status text not null default 'scheduled'
    check (status in ('scheduled','locked','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, external_id),
  -- al menos un equipo o placeholder por lado
  check (home_team_id is not null or home_placeholder is not null),
  check (away_team_id is not null or away_placeholder is not null)
);

create index fixtures_tournament_kickoff_idx
  on public.fixtures (tournament_id, kickoff_at);
create index fixtures_round_idx
  on public.fixtures (tournament_id, round_id);

create table public.match_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  fixture_id uuid not null unique references public.fixtures(id) on delete cascade,
  home_goals_90 int not null,
  away_goals_90 int not null,
  went_extra_time boolean not null default false,
  home_goals_120 int,
  away_goals_120 int,
  went_penalties boolean not null default false,
  penalty_winner_team_id uuid references public.teams(id) on delete set null,
  winner_team_id uuid references public.teams(id) on delete set null,
  qualified_team_id uuid references public.teams(id) on delete set null,
  result_status text not null default 'draft'
    check (result_status in ('draft','confirmed')),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- coherencia
  check (
    (went_extra_time = false and home_goals_120 is null and away_goals_120 is null)
    or (went_extra_time = true and home_goals_120 is not null and away_goals_120 is not null)
  ),
  check (
    (went_penalties = false and penalty_winner_team_id is null)
    or (went_penalties = true and went_extra_time = true and penalty_winner_team_id is not null)
  )
);

create table public.match_goals (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  player_id uuid references public.players(id) on delete set null,
  minute int,
  period text check (period in ('first_half','second_half','extra_time_first','extra_time_second','unknown')),
  own_goal boolean not null default false,
  penalty_goal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index match_goals_fixture_idx on public.match_goals (fixture_id);

create table public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete cascade,
  minutes_played int,
  goals int not null default 0,
  assists int not null default 0,
  yellow_cards int not null default 0,
  red_cards int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, player_id)
);
```

RLS:
- `fixtures`, `match_results`, `match_goals`, `player_match_stats`:
  select auth, all admin.

### Migración 5 — predictions

```sql
create table public.initial_predictions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  champion_team_id uuid references public.teams(id) on delete restrict,
  runner_up_team_id uuid references public.teams(id) on delete restrict,
  top_scorer_player_id uuid references public.players(id) on delete restrict,
  best_player_id uuid references public.players(id) on delete restrict,
  submitted_at timestamptz,
  locked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table public.group_qualification_predictions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  group_code text not null,
  team_id uuid not null references public.teams(id) on delete restrict,
  predicted_position int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, user_id, group_code, team_id)
);

create table public.match_predictions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  home_goals_90 int not null,
  away_goals_90 int not null,
  predicts_extra_time boolean not null default false,
  home_goals_120 int,
  away_goals_120 int,
  predicts_penalties boolean not null default false,
  predicted_winner_team_id uuid references public.teams(id) on delete set null,
  predicted_qualified_team_id uuid references public.teams(id) on delete set null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, user_id),
  check (
    (predicts_extra_time = false and home_goals_120 is null and away_goals_120 is null)
    or (predicts_extra_time = true and home_goals_120 is not null and away_goals_120 is not null)
  ),
  check (
    predicts_penalties = false or predicts_extra_time = true
  )
);

create index match_predictions_user_tournament_idx
  on public.match_predictions (tournament_id, user_id);
create index match_predictions_fixture_idx
  on public.match_predictions (fixture_id);
```

RLS:
- `initial_predictions`, `group_qualification_predictions`:
  select own o post-lock global del torneo (lo decidimos en hito 08;
  en este hito ponemos solo "select own + admin"); insert/update
  own; admin all.
- `match_predictions`: patrón completo descrito en §4.

### Migración 6 — scoring

```sql
create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  version int not null,
  rules jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, version)
);
-- Solo una versión activa por torneo.
create unique index scoring_rules_one_active_per_tournament
  on public.scoring_rules (tournament_id) where active;

create table public.prediction_scores (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  fixture_id uuid references public.fixtures(id) on delete cascade,
  prediction_type text not null
    check (prediction_type in ('match','initial','group_qualification','knockout')),
  scoring_rules_version int not null,
  points_total numeric(8,2) not null,
  points_breakdown jsonb not null,
  calculated_at timestamptz not null default now()
);
create index prediction_scores_user_idx
  on public.prediction_scores (tournament_id, user_id);
create index prediction_scores_fixture_idx
  on public.prediction_scores (tournament_id, fixture_id);

create table public.leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  total_points numeric(10,2) not null,
  rank int not null,
  created_at timestamptz not null default now(),
  unique (tournament_id, round_id, user_id)
);
```

RLS:
- `scoring_rules`: select auth, all admin.
- `prediction_scores`, `leaderboard_snapshots`: select auth (todos
  ven los puntos de todos para construir leaderboards), insert/
  update/delete solo admin.

---

## 6. Acceptance criteria del hito

- [ ] 5 migraciones nuevas en `supabase/migrations/`, aplicables
      con `npm run db:reset` sin errores.
- [ ] `database.types.ts` regenerado tras la última migración y
      compilando (`npm run typecheck`).
- [ ] `npm run build` pasa.
- [ ] Test rápido vía Studio o psql:
      - `select * from tournaments` con `service_role` funciona.
      - Con un usuario `authenticated` ficticio, no se puede
        insertar en `teams` (RLS lo rechaza salvo admin).
- [ ] Migraciones aplicadas a producción con `npm run db:push`.
- [ ] Bitácora `04-database-schema-implementation.md` creada con
      decisiones, errores y verificaciones.

---

## 7. Riesgos / dudas conocidas

- **Recursión en policies que consultan `profiles`**: mitigada con
  `security definer` + `set search_path = public` en `is_admin`.
- **Performance de policies**: en este volumen (10 usuarios, decenas
  de fixtures) no es un problema. Si más adelante el evaluador
  empieza a notar lentitud en leaderboards, materializar
  `prediction_scores` en una vista o regenerar `leaderboard_snapshots`.
- **Desacople entre `predicts_extra_time` y `home_goals_120`**: lo
  enforzamos con `check`. La UI tendrá que ofrecer los campos
  condicionalmente.
- **`profiles.role` solo modificable por admin**: lo expresamos en
  la policy `update` añadiendo `(new.role is not distinct from
  old.role) or public.is_admin()`. Lo escribimos así de
  explícitamente al construir la migración.
- **`auth.users` vs `profiles`**: las FKs apuntan a `profiles.user_id`
  para que `cascade` desde `auth.users` arrastre todo automáticamente
  (porque `profiles.user_id` ya tiene `on delete cascade` desde
  `auth.users`).

---

## 8. Qué queda preparado para el siguiente hito (05)

- Esqueleto de auth (tabla `profiles`) listo para que el hito 05
  añada el trigger `handle_new_user()` y monte las páginas de
  login/registro.
- Tabla `terms_acceptances` lista para registrar la aceptación de
  versión activa de reglas.
- Resto del modelo en su sitio para que los hitos 06+ inserten
  seeds y datos de usuarios.
