# 01 — Plan de implementación (índice maestro)

Este documento es el índice maestro del plan de implementación de la app
de la porra del Mundial 2026. Convierte el PID
(`context/initial-setup/02-pid.md`) en una secuencia ordenada de hitos
ejecutables.

Cada hito tendrá su propio fichero detallado dentro de `context/plan/`
(`02-XXX.md`, `03-XXX.md`, …). **Esos ficheros se irán creando uno a uno
justo antes de empezar cada hito**, no todos a la vez. Este `01-plan.md`
sirve para:

- Saber qué hitos existen y en qué orden.
- Conocer las decisiones técnicas comunes a todos.
- Tener un resumen + esqueletos de alto nivel de cada hito.
- Localizar dependencias entre hitos.

> Nota de idiomas: La UI es **en español** (los usuarios son españoles,
> los amigos del autor). Las tablas, columnas y código son en inglés.
> Mensajes de error visibles al usuario, copys, labels y tooltips → en
> español.

---

## 1. Cómo se usa este plan

1. Cuando empezamos un hito (por ejemplo `02-project-setup`), creamos
   primero el fichero detallado correspondiente en `context/plan/`.
2. Implementamos el hito en el código.
3. Mientras se implementa, vamos registrando avances/errores/cambios de
   decisión en `context/implementations/NN-XXX-implementation.md`
   (ese folder lo crea el autor cuando empezamos a implementar).
4. Cerrado el hito, pasamos al siguiente.

Convenciones de nombres de ficheros:

```txt
context/
  initial-setup/
    01-brainstorming-prompt.md
    02-pid.md
  plan/
    0-plan-prompt.md
    01-plan.md                         ← este fichero
    02-project-setup.md                ← se crea al empezar el hito
    03-supabase-local-and-migrations.md
    ...
  implementations/
    02-project-setup-implementation.md ← se crea durante el hito
    ...
```

---

## 2. Decisiones técnicas ya cerradas (recordatorio)

Vienen del PID. Aquí solo el resumen accionable.

- **Frontend + backend:** Next.js (App Router) + TypeScript + Tailwind.
- **DB / Auth / Storage:** Supabase (Postgres + Auth + RLS).
- **Migraciones:** Supabase CLI con SQL versionado. Sin Prisma.
- **Validación:** Zod en formularios y al importar JSONs.
- **Hosting:** Vercel (free tier), conectado a GitHub.
- **Modelo multi-torneo:** una sola DB, schema `public`, columna
  `tournament_id` en las tablas de dominio. Sin schemas por torneo.
- **Resultados:** introducidos manualmente por el admin. Nada de
  scraping ni Gemini dentro del flujo productivo de la app.
- **Passwords:** vía Supabase Auth, nunca en texto plano.
- **Fuente de verdad:** Supabase. Los JSONs solo sirven como seeds
  iniciales (equipos, jugadores, calendario).
- **Free tier estricto:** todo en planes gratuitos (Vercel Hobby,
  Supabase Free, GitHub).
- **Iteración:** local-first. Probamos en local con Supabase CLI antes
  de desplegar a Vercel.
- **Recálculo de puntuaciones:** siempre desde cero al confirmar un
  resultado o al cambiar reglas. Es barato dado el volumen.
- **Testing inicial:** dataset Catar 2022 cargado como
  `tournament_id` separado del Mundial 2026.
- **Documentación:** prompts e implementaciones en `context/`.

---

## 3. Arquitectura de alto nivel

```txt
┌──────────────────────────────────────────────────────────────┐
│                     Browser (Next.js client)                 │
│  Tailwind UI · React Server Components · supabase-js anon    │
└──────────────┬─────────────────────────────────┬─────────────┘
               │                                 │
               │ Server Actions / Route Handlers │
               ▼                                 │
┌──────────────────────────────────────────┐     │
│           Next.js (Vercel)               │     │
│ - lib/supabase/{client,server,admin}.ts  │     │
│ - lib/scoring/*                          │     │
│ - lib/dates/predictionLock.ts            │     │
│ - lib/permissions/{requireAuth,Admin}.ts │     │
│ - app/(app)/* + app/admin/*              │     │
└──────────────┬───────────────────────────┘     │
               │ service-role (server only)      │ anon (RLS)
               ▼                                 ▼
┌──────────────────────────────────────────────────────────────┐
│                     Supabase Postgres                        │
│  Auth · RLS · migrations (supabase/migrations/*.sql) · seed  │
└──────────────────────────────────────────────────────────────┘
```

Dos perfiles de cliente Supabase:

- `lib/supabase/client.ts` → browser, ANON key. Sujeto a RLS.
- `lib/supabase/server.ts` → server components / actions, ANON key
  con sesión del usuario. También sujeto a RLS.
- `lib/supabase/admin.ts` → solo en server actions privilegiadas.
  Service role key. Bypass de RLS. Usado para recálculos y resets.

---

## 4. Entornos y workflow Git

```txt
Local
  · Supabase CLI (Docker) corriendo Postgres + Studio en localhost
  · .env.local con NEXT_PUBLIC_SUPABASE_URL y keys locales
  · npm run dev sirve Next.js apuntando a la DB local

Preview (cualquier PR)
  · Vercel Preview Deployment
  · Apunta al proyecto Supabase de PRODUCCIÓN (free tier no permite
    múltiples) o, si crece, a un proyecto "staging" separado.
    Decisión por defecto: preview → producción Supabase, con cuidado
    al hacer migraciones (las hacemos nosotros manualmente con
    `supabase db push` cuando queremos aplicarlas).

Producción
  · main/master → Vercel Production
  · Migraciones se aplican manualmente con `supabase db push` desde
    local tras hacer merge a master (no automático en CI al inicio).
```

Branching:

```txt
master                  → producción
feat/<nombre>           → trabajo en hitos
fix/<nombre>            → bugs
chore/<nombre>          → tooling, deps, docs
```

Cada hito = una rama. Un PR por hito (o varios pequeños si tiene
sentido). PRs pequeños y frecuentes.

---

## 5. Estrategia de UI en español

- **Sin librería de i18n al principio.** Strings literales en español
  en los componentes. Si más adelante hace falta cambiar, ya
  introducimos `next-intl` o similar.
- **Constantes de copy** en `lib/copy/*.ts` para los textos largos
  (términos y condiciones, mensajes de admin) — fácil de revisar.
- **Formato de fechas y horas:** zona horaria de España
  (`Europe/Madrid`) por defecto en la UI; en DB siempre
  `timestamptz`.
- **Etiquetas técnicas en código en inglés**, mensajes al usuario en
  español. Ejemplo:
  ```ts
  // OK en código
  if (lockState === "locked") return "Bloqueado";
  ```

---

## 6. Roadmap — vista general

| #  | Hito                             | Fichero detallado                          | Fase |
|----|----------------------------------|--------------------------------------------|------|
| 02 | Project setup                    | `02-project-setup.md`                      | A. Foundation |
| 03 | Supabase local + migraciones     | `03-supabase-local-and-migrations.md`      | A |
| 04 | Esquema de base de datos         | `04-database-schema.md`                    | A |
| 05 | Auth + profiles + roles          | `05-auth-and-profiles.md`                  | A |
| 06 | Seeds e importación master data  | `06-seed-and-import-master-data.md`        | B. Master data |
| 07 | Admin: fixtures y jugadores      | `07-admin-fixtures-and-players.md`         | B |
| 08 | Predicciones iniciales           | `08-initial-predictions.md`                | C. Predicciones |
| 09 | Predicciones de partidos         | `09-match-predictions.md`                  | C |
| 10 | Admin: introducción de resultados| `10-admin-results-entry.md`                | D. Resultados |
| 11 | Motor de puntuación              | `11-scoring-engine.md`                     | D |
| 12 | Leaderboards y gráfico evolución | `12-leaderboards-and-visuals.md`           | E. Visualización |
| 13 | ~~Resultados públicos y stats~~  | ~~eliminado en cierre del hito 12~~        | — |
| 14 | Admin: reset y reglas            | `14-admin-reset-and-rules.md`              | F. Pulido |
| 15 | Diseño UI español                | `15-ui-design-spanish.md`                  | F |
| 16 | Despliegue producción + CI/CD    | `16-production-deployment.md`              | F |
| 17 | Test E2E con Catar 2022          | `17-end-to-end-test-catar-2022.md`         | G. Validación |

Los hitos se entregan en orden. Por defecto serial. **Hito 13
eliminado** al cerrar el hito 12: los resultados y desgloses ya son
visibles desde `/clasificacion/partido/[fixtureId]` y la app no
trackea goles por jugador ni estadísticas de selección.

---

## 7. Resumen detallado de cada hito

A continuación, un resumen accionable de cada hito. Cuando llegue su
turno, expandimos a su fichero `NN-XXX.md` con todos los detalles.

### Hito 02 — Project setup
Archivo destino: `02-project-setup.md`.

**Goal:** Repo Next.js funcionando en local, con tooling, estructura
de carpetas, y proyectos Vercel + Supabase creados (vacíos).

**Scope:**
- `npx create-next-app@latest` con TypeScript, App Router, Tailwind,
  ESLint, src dir opcional. Usar `--use-npm`.
- Añadir Prettier + config compartida.
- Estructura de carpetas inicial (`app/`, `lib/`, `components/`,
  `supabase/`, `data/seeds/`).
- `.env.example` con las variables esperadas.
- `.gitignore` actualizado (`.env.local`, `supabase/.branches`, etc.).
- Crear proyecto Vercel free tier vinculado al repo (manual, vía
  dashboard) — sin desplegar nada útil aún, solo verificar que el
  pipeline funciona.
- Crear proyecto Supabase free tier (manual, vía dashboard). Anotar
  URL y keys.
- README mínimo: cómo instalar y arrancar.

**Skeleton de carpetas:**
```txt
src/
  app/
    layout.tsx
    page.tsx
    (auth)/login/page.tsx
    (auth)/register/page.tsx
    (app)/dashboard/page.tsx
    admin/page.tsx
  components/
    layout/
    ui/
  lib/
    supabase/
      client.ts
      server.ts
      admin.ts
    permissions/
    dates/
    copy/
  styles/
data/seeds/
supabase/
  config.toml
  migrations/
  seed.sql
```

**Acceptance:** `npm run dev` levanta la home; un PR a master genera
un Preview Deployment en Vercel.

---

### Hito 03 — Supabase local + migraciones
Archivo destino: `03-supabase-local-and-migrations.md`.

**Goal:** Tener Supabase corriendo en local (Docker) y un workflow de
migraciones SQL versionado, replicable entre local y producción.

**Scope:**
- Instalar Supabase CLI.
- `supabase init` en el repo.
- Configurar `supabase/config.toml` (project_id, puertos por defecto).
- Crear scripts npm:
  ```json
  {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:diff": "supabase db diff -f",
    "db:push": "supabase db push",
    "types:gen": "supabase gen types typescript --local > src/lib/supabase/database.types.ts"
  }
  ```
- Generar tipos TS (`database.types.ts`) y atarlos a los clientes.
- Definir convención de nombres de migraciones:
  `YYYYMMDDHHMMSS_descripcion_corta.sql`.
- Definir `supabase/seed.sql` (vacío de momento).
- Decisión clave: las migraciones se aplican a producción
  manualmente desde local con `supabase db push`, **no en CI al
  inicio**, para evitar accidentes.

**Skeleton `database.types.ts`:** se autogenera; lo importan los
clientes:
```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
```

**Acceptance:** `npm run db:start` levanta Postgres+Studio en local,
`supabase db reset` lo deja limpio y aplica migraciones, y los tipos
TS se regeneran sin errores.

---

### Hito 04 — Esquema de base de datos
Archivo destino: `04-database-schema.md`.

**Goal:** Migraciones SQL que crean todas las tablas de dominio,
índices y RLS básica.

**Scope (tablas, ya descritas en el PID §4):**

```txt
tournaments
profiles                       -- 1:1 con auth.users
terms_acceptances
teams                          -- por torneo
players                        -- por torneo, por team
stages                         -- catálogo: group_stage, round_of_16, ...
rounds                         -- jornadas dentro de stage
fixtures
match_results                  -- 1:1 con fixture
match_goals
player_match_stats             -- opcional, alimentación progresiva
initial_predictions            -- 1 por usuario por torneo
group_qualification_predictions
match_predictions              -- 1 por usuario por fixture
scoring_rules                  -- versión activa por torneo
prediction_scores              -- derivada, recalculable
leaderboard_snapshots          -- derivada (opcional)
```

**Migraciones por archivo (orden):**
```txt
20260507_000001_extensions.sql                  -- pgcrypto, citext si hace falta
20260507_000002_tournaments_and_profiles.sql
20260507_000003_master_data.sql                 -- teams, players, stages, rounds
20260507_000004_fixtures_and_results.sql        -- fixtures, match_results, match_goals, player_match_stats
20260507_000005_predictions.sql                 -- initial, group_qualification, match
20260507_000006_scoring.sql                     -- scoring_rules, prediction_scores, leaderboard_snapshots
20260507_000007_rls_policies.sql                -- todas las policies
20260507_000008_indexes.sql                     -- índices auxiliares
```

**RLS — política general:**
- `select`: cualquier usuario autenticado puede leer datos de
  tournaments, teams, players, fixtures, match_results, match_goals,
  scoring_rules, prediction_scores, leaderboard_snapshots.
- `select` de predicciones de OTROS usuarios: solo si la fixture está
  bloqueada (`now() >= kickoff_at - interval '24 hours'`).
- `insert/update/delete` de predicciones: solo el dueño y solo si el
  fixture aún no está bloqueado.
- `insert/update/delete` de master data y resultados: solo `admin`.
- `profiles`: cada usuario lee/edita su propia fila; admin lee todas.

**Skeleton SQL representativo:**
```sql
create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage_id uuid not null references public.stages(id),
  round_id uuid not null references public.rounds(id),
  group_code text,
  home_team_id uuid references public.teams(id),
  away_team_id uuid references public.teams(id),
  home_placeholder text,
  away_placeholder text,
  kickoff_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','locked','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fixtures_tournament_kickoff_idx
  on public.fixtures (tournament_id, kickoff_at);
```

**Skeleton de policy:**
```sql
create policy "match predictions visible after lock"
  on public.match_predictions for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.fixtures f
      where f.id = match_predictions.fixture_id
        and now() >= f.kickoff_at - interval '24 hours'
    )
  );
```

**Acceptance:** `supabase db reset` aplica las migraciones limpiamente.
`select` desde un cliente anon respeta RLS (probarlo con scripts).

---

### Hito 05 — Auth + profiles + roles
Archivo destino: `05-auth-and-profiles.md`.

**Goal:** Login/registro funcional con Supabase Auth, fila `profiles`
creada automáticamente, distinción admin/player, y aceptación de
términos antes de operar.

**Scope:**
- Usar `@supabase/ssr` para sesiones server-side en App Router.
- Trigger SQL `on auth.users insert` que crea la fila `profiles`
  con `display_name` por defecto y `role = 'player'`.
- Promoción a `admin` se hace manualmente desde Supabase Studio
  (un `update profiles set role = 'admin' where user_id = '...'`).
- Página `/login` y `/register` (server actions con `signInWithPassword`
  / `signUp`).
- Middleware `src/middleware.ts` que refresca la sesión.
- Helpers `requireAuth()` y `requireAdmin()` en `lib/permissions/`.
- Página `/rules` (T&C). Si el usuario no ha aceptado la versión
  activa, redirigir aquí. Aceptación = insert en `terms_acceptances`.

**Skeleton trigger profile:**
```sql
create function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, display_name, initials, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data->>'display_name', new.email), 2)),
    'player'
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
```

**Skeleton requireAdmin:**
```ts
// src/lib/permissions/requireAdmin.ts
export async function requireAdmin() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("user_id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");
  return { user, profile };
}
```

**Acceptance:** registro crea profile; login redirige a `/rules` si
no se ha aceptado; un user con role `player` no puede entrar en
`/admin/*`.

---

### Hito 06 — Seeds e importación de master data
Archivo destino: `06-seed-and-import-master-data.md`.

**Goal:** Poblar `tournaments`, `teams`, `players`, `stages`, `rounds`
y `fixtures` para Catar 2022 a partir de JSONs en `data/seeds/`.

**Scope:**
- Definir formato JSON (ya esbozado en PID §4.3) y schemas Zod.
- `data/seeds/wc_2022/` con:
  - `tournament.json`
  - `teams.json`
  - `players.json`
  - `fixtures.json`
- Script `npm run seed:wc2022` que:
  1. Lee los JSONs.
  2. Valida con Zod.
  3. Hace upsert idempotente (clave: `external_id` o
     `(tournament_id, code)`).
  4. Resuelve referencias por nombre/alias usando matching
     case-insensitive y `aliases jsonb`.
  5. En fase de eliminación, deja placeholders `Winner Group A`
     etc. hasta que el admin asigne equipos reales.
- El script usa la **service role key** y se ejecuta manualmente
  desde local, nunca en CI.
- Para 2026 se replicará la estructura cuando el calendario oficial
  esté disponible (`data/seeds/wc_2026/`).

**Skeleton importer:**
```ts
// scripts/seed/wc-2022.ts
const TournamentSchema = z.object({ name: z.string(), year: z.number() });
const FixturesSchema = z.object({ fixtures: z.array(FixtureSchema) });

async function main() {
  const supabase = createAdminClient();           // service role
  const tournament = await upsertTournament(...); // returns id
  await upsertTeams(supabase, tournament.id, teamsJson);
  await upsertPlayers(supabase, tournament.id, playersJson);
  await upsertStagesAndRounds(supabase, tournament.id);
  await upsertFixtures(supabase, tournament.id, fixturesJson);
}
```

**Acceptance:** ejecutar el seed dos veces seguidas no duplica filas.
Tras el seed, `select count(*) from fixtures where tournament_id =
'wc2022'` da 64. Equipos y jugadores cuadran.

---

### Hito 07 — Admin: fixtures y jugadores
Archivo destino: `07-admin-fixtures-and-players.md`.

**Goal:** Páginas admin para ver/editar fixtures y gestionar jugadores
sin reutilizar IDs.

**Scope:**
- `/admin/fixtures`:
  - Lista de fixtures filtrada por jornada/ronda.
  - Editar `kickoff_at`, equipos asignados (clave para eliminatorias
    cuando se conozcan los cruces), estado.
  - Reasignación de placeholders → team real en eliminatorias.
- `/admin/players`:
  - Listado por equipo.
  - Añadir nuevo jugador (genera ID nuevo siempre).
  - Marcar `active = false` para "borrar" (soft-delete) cuando
    haya predicciones que lo referencian.
  - Editar `display_name` y `aliases`.
  - **No se permite** editar el `id`. **No se permite** un hard
    delete de jugadores referenciados por predicciones.

**Skeleton de regla de soft-delete:**
```ts
async function deactivatePlayer(playerId: string) {
  const refs = await countReferences(playerId); // initial_predictions, match_goals
  if (refs > 0) {
    await supabase.from("players").update({ active: false }).eq("id", playerId);
  } else {
    await supabase.from("players").delete().eq("id", playerId);
  }
}
```

**Acceptance:** un admin puede asignar Brasil a un placeholder de
octavos; un admin puede añadir un jugador nuevo en mitad del
torneo sin romper predicciones existentes.

---

### Hito 08 — Predicciones iniciales
Archivo destino: `08-initial-predictions.md`.

**Goal:** Cada usuario puede registrar (una sola vez) sus predicciones
de campeón, subcampeón, pichichi, mejor jugador, y clasificados de
grupo. Vista pública comparativa.

**Scope:**
- `/predicciones/iniciales` (URL en español; ruta en inglés
  `app/(app)/predictions/initial/page.tsx` está bien).
- Form con:
  - Campeón (select sobre teams del torneo).
  - Subcampeón.
  - Pichichi (select de players con search; el dropdown muestra
    los primeros 20 y filtra al escribir).
  - Mejor jugador.
  - Clasificados por grupo (2 o 3 según formato; configurable por
    torneo).
- Lock: una fecha global del torneo (`predictions_open_until` en
  `tournaments`) o el `kickoff_at` del primer partido. Decisión por
  defecto: `min(kickoff_at) - 24h` calculado dinámicamente.
- Vista pública `/predicciones/iniciales/publicas`:
  - Una "card" por usuario, scroll vertical (no dropdown de usuarios).
  - Dropdown por **categoría** (campeón / subcampeón / pichichi…).
  - Solo visible cuando las predicciones estén bloqueadas
    globalmente, o ya empezado el torneo.

**Acceptance:** un usuario puede guardar/editar sus predicciones
iniciales hasta el lock; tras el lock, solo lectura; vista pública
muestra a todos.

---

### Hito 09 — Predicciones de partidos
Archivo destino: `09-match-predictions.md`.

**Goal:** Cada usuario predice cada partido, con reglas distintas
para fase de grupos vs eliminatorias. Lock 24h antes del kickoff.
Vista pública por jornada.

**Scope:**
- Util `lib/dates/predictionLock.ts`:
  ```ts
  export function isLocked(kickoffAt: Date, now = new Date()) {
    return now.getTime() >= kickoffAt.getTime() - 24 * 60 * 60 * 1000;
  }
  ```
- `/predicciones/partidos`:
  - Dropdown de jornada/ronda.
  - Lista de fixtures con form inline.
  - Para fase de grupos: solo `home_goals_90` y `away_goals_90`.
  - Para eliminatorias:
    - `home_goals_90`, `away_goals_90`.
    - Toggle "irá a prórroga".
    - Si prórroga: `home_goals_120`, `away_goals_120`.
    - Toggle "irá a penaltis".
    - Select "equipo que pasa".
  - Validación cruzada: si predices empate a 90 y no marcas
    prórroga, no puedes elegir un ganador. Si predices penaltis,
    debes haber marcado prórroga.
- Servidor valida también el lock antes de aceptar el upsert.
- Vista pública `/predicciones/partidos/publicas` con la misma
  estructura: una card por usuario por fixture, comparable.

**Skeleton de validación Zod:**
```ts
const KnockoutPredictionSchema = z.object({
  fixture_id: z.string().uuid(),
  home_goals_90: z.number().int().nonnegative(),
  away_goals_90: z.number().int().nonnegative(),
  predicts_extra_time: z.boolean(),
  home_goals_120: z.number().int().nullable(),
  away_goals_120: z.number().int().nullable(),
  predicts_penalties: z.boolean(),
  predicted_qualified_team_id: z.string().uuid(),
}).refine(p => !p.predicts_penalties || p.predicts_extra_time, {
  message: "Si vas a penaltis, debe haber prórroga"
});
```

**Acceptance:** UI bloquea edición a las 24h del kickoff; backend
también la rechaza; un user no ve predicciones de otros antes del
lock.

---

### Hito 10 — Admin: introducción de resultados
Archivo destino: `10-admin-results-entry.md`.

**Goal:** Admin introduce resultados manualmente, dispara el
recálculo del torneo al confirmar.

**Scope:**
- `/admin/resultados`:
  - Dropdown de jornada/ronda → lista de fixtures.
  - Por fixture, formulario:
    - Goles a 90'.
    - Toggle "fue a prórroga".
    - Si sí: goles a 120'.
    - Toggle "fue a penaltis".
    - Select "equipo que ganó/pasó".
    - Lista de goles: por cada gol, equipo + jugador (search en
      lista del equipo) + minuto opcional + flags (own goal,
      penalti).
  - Estado: `draft` mientras se edita, `confirmed` al pulsar
    "confirmar y recalcular".
- Al confirmar:
  1. Upsert `match_results`.
  2. Reemplazo total de `match_goals` para ese fixture.
  3. Llamar al recálculo del torneo (hito 11).
- Si se edita un resultado ya `confirmed`: marcarlo como
  modificado y volver a recalcular.

**Skeleton:**
```ts
"use server";
export async function confirmMatchResult(input: ConfirmInput) {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.rpc("upsert_match_result", input);
  await recalculateTournamentScores(input.tournament_id);
}
```

**Acceptance:** introducir un resultado actualiza la página de
resultados públicos y dispara el recálculo, que se refleja en el
leaderboard.

---

### Hito 11 — Motor de puntuación
Archivo destino: `11-scoring-engine.md`.

**Goal:** Función pura que dado (predicción, resultado, reglas)
devuelve `{ points_total, points_breakdown }`. Orquestador que
recalcula todo el torneo.

**Scope:**
- `scoring_rules` con la estructura JSON ya descrita en PID §4.2
  (subseccción `scoring_rules`). Versión 1 con valores conservadores
  (los exactos quedan como decisión pendiente).
- Funciones puras en `src/lib/scoring/`:
  - `scoreGroupMatch(prediction, result, rules)`.
  - `scoreKnockoutMatch(prediction, result, rules)`.
  - `scoreInitialPrediction(...)`.
  - `scoreGroupQualificationPrediction(...)`.
  - `applyStageMultiplier(points, stageCode, rules)`.
- Orquestador `recalculateTournamentScores(tournamentId)`:
  1. Borra todas las filas de `prediction_scores` del torneo.
  2. Lee predicciones + resultados + reglas activas.
  3. Calcula in-memory.
  4. Inserta en bulk.
- Tests unitarios con casos representativos (acierto exacto, cerca
  por un gol, prórroga acertada, penaltis, equipo que pasa).
- Devolver siempre `points_breakdown` legible, ej:
  ```json
  {
    "correct_winner": 5,
    "home_goals_close_by_1": 2,
    "away_goals_exact": 3,
    "goal_difference_exact": 3,
    "stage_multiplier": 1.4,
    "subtotal": 13,
    "total": 18.2
  }
  ```

**Skeleton scoreGroupMatch:**
```ts
export function scoreGroupMatch(p: MatchPrediction, r: MatchResult, rules: Rules) {
  const breakdown: Record<string, number> = {};
  const winnerActual = sign(r.home_goals_90 - r.away_goals_90);
  const winnerPred = sign(p.home_goals_90 - p.away_goals_90);
  if (winnerActual === winnerPred) breakdown.correct_winner = rules.match.correct_winner;
  if (p.home_goals_90 === r.home_goals_90 && p.away_goals_90 === r.away_goals_90) {
    breakdown.exact_score = rules.match.exact_score_90;
  }
  // ...goal_distance, goal_difference_close, etc.
  const subtotal = sum(values(breakdown));
  const mult = rules.stage_multipliers.group_stage;
  return { subtotal, total: subtotal * mult, breakdown };
}
```

**Acceptance:** suite de tests unitarios verde; recalcular el torneo
de Catar 2022 con datos manuales coincide con cálculo a mano de
unos 5-10 partidos representativos.

---

### Hito 12 — Leaderboards y gráfico de evolución
Archivo destino: `12-leaderboards-and-visuals.md`.

**Goal:** Vistas de clasificación general, desgloses, y un gráfico
estilo "burbujas con iniciales" que muestra evolución por jornada.

**Scope:**
- `/clasificacion` — leaderboard total. Estilo tipo Champions:
  - Top destacado (verde claro o color primario).
  - Bottom (último/penúltimo) con un fondo distinto (rojo suave).
- `/clasificacion/desglose` — leaderboards parciales:
  - Por jornada.
  - Por fase (grupos / octavos / cuartos / semis / final).
  - Por categoría: resultados de partidos, predicciones iniciales,
    clasificados de grupo, eliminatorias, prórroga, penaltis,
    cercanía de goles.
  - Implementado vía vistas SQL o queries con `group by` sobre
    `prediction_scores` + `points_breakdown`.
- `/clasificacion/evolucion`:
  - Eje X: jornadas/rondas (por `sort_order`).
  - Eje Y: puntos acumulados.
  - Cada usuario es una burbuja con sus iniciales.
  - Recharts (`ScatterChart` + `LabelList`) o D3 ligero.
  - Anti-overlap: pequeño jitter en Y o agrupar por bandas.
- Si el coste de calcular acumulados on-the-fly es alto, materializar
  en `leaderboard_snapshots` durante el recálculo.

**Acceptance:** tras introducir resultados de unas jornadas en Catar
2022, las vistas reflejan el orden esperado.

---

### Hito 13 — ELIMINADO

La página `/resultados` y `/estadisticas/selecciones` se descartan:

- Los resultados por partido ya son visibles para todos en
  `/clasificacion/partido/[fixtureId]` (que muestra el marcador
  oficial + las predicciones de cada participante) y dentro del
  `LockedFixturePanel` de `/predictions/matches` cuando la ronda
  está bloqueada.
- La app **no trackea goles por jugador** (decisión del usuario
  cerrada en hito 12). Sin `player_match_stats` poblada las stats
  de selección no aportan, así que se descarta esa página entera.

El plan continúa directamente en el hito 14.

---

### Hito 14 — Admin: reset y reglas
Archivo destino: `14-admin-reset-and-rules.md`.

**Goal:** El admin puede (a) resetear datos de un torneo con
confirmación escribiendo `BORRAR`, y (b) versionar/activar reglas
de puntuación.

**Scope:**
- `/admin/reset`:
  - Selector de torneo.
  - Checkbox de qué borrar (predicciones, resultados, goles,
    scores, snapshots).
  - Modal de confirmación que requiere escribir literal `BORRAR`.
  - Server action que ejecuta deletes con `tournament_id` como
    filtro, en una transacción.
  - Por defecto **no** borra `tournaments`, `teams`, `players`,
    `fixtures` (master data).
- `/admin/reglas`:
  - Lista de versiones de `scoring_rules` por torneo.
  - Botón "duplicar y editar" → crea una nueva versión inactiva.
  - Editor JSON con validación Zod.
  - Botón "activar" → marca `active = true` y desactiva las demás.
  - Botón "recalcular ahora" → llama al orquestador.

**Acceptance:** un reset limpia las tablas seleccionadas del torneo
indicado y deja intactas las del otro torneo.

---

### Hito 15 — Diseño UI español
Archivo destino: `15-ui-design-spanish.md`.

**Goal:** Aplicar la paleta de colores definitiva, layout consistente,
copys en español revisados, y componentes UI reutilizables.

**Scope:**
- Paleta de colores: pendiente de que el usuario la entregue.
  Hasta entonces, neutral con primarios oscuros (rojo/azul).
- Tema Tailwind en `tailwind.config.ts` con tokens semánticos
  (`primary`, `accent`, `success`, `warning`, `danger`).
- Layout principal con header, navegación y footer.
- Estados: empty, loading, error — todos en español.
- Revisión de copys: rules, validaciones, mensajes admin.
- Decisiones tipográficas (Inter por defecto, fallback system).
- Iconos: lucide-react.
- Accesibilidad básica: contraste suficiente, labels en formularios,
  foco visible.

**Acceptance:** la app tiene una sensación visual coherente y todos
los textos visibles al usuario están en español.

---

### Hito 16 — Despliegue producción + CI/CD
Archivo destino: `16-production-deployment.md`.

**Goal:** Producción en Vercel + Supabase, con un flujo de
deployment seguro y CI básico que no rompa main.

**Scope:**
- Configurar variables de entorno en Vercel (production y preview):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nueva clave pública,
    reemplaza `ANON_KEY`)
  - `SUPABASE_SECRET_KEY` (no expuesta al cliente, reemplaza
    `SERVICE_ROLE_KEY`)
- GitHub Actions `.github/workflows/ci.yml`:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test` (si hay tests)
- Branch protection en `master`: requiere CI verde + 0 reviewers
  (solo el autor) o self-approve.
- Workflow de migraciones a producción **manual**:
  1. Merge del PR a master.
  2. En local: `supabase link --project-ref <prod>`.
  3. `supabase db push --linked` con confirmación.
  4. Anotar en `context/implementations/` qué migraciones se
     aplicaron y cuándo.
- (Opcional) GitHub Action que solo **valide** las migraciones
  (`supabase db lint` o un dry-run en una DB efímera) sin
  aplicarlas.

**Acceptance:** un PR mergeado se despliega en Vercel automáticamente;
las migraciones se pueden aplicar a producción sin sorpresas.

---

### Hito 17 — Test E2E con Catar 2022
Archivo destino: `17-end-to-end-test-catar-2022.md`.

**Goal:** Validar el sistema completo con datos reales de Catar 2022
antes de cargar Mundial 2026.

**Scope (en orden):**
1. Seed `wc_2022` cargado (hito 06).
2. Crear 3-5 usuarios de prueba (incluyendo uno admin y varios
   players).
3. Cada player introduce predicciones iniciales y predicciones
   de fase de grupos.
4. **Pausa donde el autor (admin) introduce manualmente los
   resultados de la Jornada 1 de grupos** (es lo que mencionaba
   el prompt: el admin completa los resultados a mano).
5. Verificar que el recálculo da puntuaciones razonables.
6. Repetir para Jornada 2 y Jornada 3.
7. Probar un partido de prórroga (p.ej. Croacia-Japón octavos
   2022) y uno de penaltis.
8. Probar correcciones: cambiar un goleador, comprobar que el
   recálculo lo refleja.
9. Probar reset del torneo de prueba.
10. Crear `World Cup 2026` (otro `tournament_id`) y replicar
    seeds cuando esté el calendario oficial.

**Reportar en cada paso:** qué se probó, qué fallos surgieron,
qué decisiones cambiaron. Todo en
`context/implementations/17-end-to-end-test-catar-2022-implementation.md`.

**Acceptance:** todo el flujo funciona con datos reales del 2022;
el reset deja la DB lista para 2026.

---

## 8. Resumen del flujo de testing con Catar 2022

```txt
[Hitos 02-05] Setup local + Auth funcionando
                ↓
[Hito 06] Seeds de Catar 2022 cargados
                ↓
[Hito 07] Admin verifica fixtures y jugadores
                ↓
[Hito 08-09] Players de prueba meten predicciones
                ↓
[Hito 10] Admin (manualmente) introduce resultados de Jornada 1
                ↓
[Hito 11] Motor de puntuación recalcula
                ↓
[Hito 12-13] Leaderboard y resultados visibles
                ↓
ITERAR Jornada 2, Jornada 3, octavos, cuartos, semis, final
                ↓
[Hito 14] Reset del torneo de prueba
                ↓
Listo para crear y poblar Mundial 2026
```

El "momento manual" del autor cae en el hito 10 y se repite cada
jornada. Es por diseño y está OK.

---

## 9. Decisiones pendientes

Las que ya menciona el PID (§9.2) más algunas adicionales que
emergerán durante la implementación:

- Valores numéricos exactos del scoring (hito 11).
- Cuántos clasificados por grupo en 2026 (depende del formato
  oficial; en 2022 fueron 2; en 2026 serán 2 + 8 mejores terceros
  según FIFA, lo confirmaremos antes del hito 06).
- Política de reset por defecto: ¿borra también master data o no?
  (decisión por defecto: no, salvo flag explícito).
- Si materializamos `leaderboard_snapshots` o calculamos on-the-fly
  (decisión en hito 12 según rendimiento real).
- Paleta de colores definitiva (hito 15).

---

## 10. Riesgos resaltados (extraídos del PID)

- **Free tier:** vigilar uso de Supabase (filas, storage, requests)
  y de Vercel (build minutes, bandwidth). Para 10 usuarios estamos
  muy lejos de límites, pero conviene revisarlo en hito 16.
- **Zonas horarias:** todo `timestamptz` en DB, conversión a
  `Europe/Madrid` solo en la UI.
- **IDs de jugadores:** nunca reutilizar (hito 07).
- **Race conditions en lock 24h:** validar tanto en cliente como
  en server (hito 09).
- **Migraciones a prod:** aplicación manual deliberada para evitar
  sustos (hito 16).

---

## 11. Índice de ficheros que se irán creando

```txt
context/plan/
  01-plan.md                                   ← este fichero
  02-project-setup.md                          [pendiente]
  03-supabase-local-and-migrations.md          [pendiente]
  04-database-schema.md                        [pendiente]
  05-auth-and-profiles.md                      [pendiente]
  06-seed-and-import-master-data.md            [pendiente]
  07-admin-fixtures-and-players.md             [pendiente]
  08-initial-predictions.md                    [pendiente]
  09-match-predictions.md                      [pendiente]
  10-admin-results-entry.md                    [pendiente]
  11-scoring-engine.md                         [pendiente]
  12-leaderboards-and-visuals.md               [pendiente]
  14-admin-reset-and-rules.md                  [pendiente]
  15-ui-design-spanish.md                      [pendiente]
  16-production-deployment.md                  [pendiente]
  17-end-to-end-test-catar-2022.md             [pendiente]

context/implementations/                       [se crea al empezar]
  02-project-setup-implementation.md
  ...
```

---

## 12. Próximo paso

Cuando confirmes este índice, abrimos el primer hito creando
`context/plan/02-project-setup.md` con todo el detalle (comandos,
contenidos exactos de `package.json`, estructura final, decisiones
de tooling y un checklist de salida) y empezamos a implementar.
