# 08 — Predicciones iniciales · plan

> Hito 08 del roadmap (`context/plan/01-plan.md` §7).
> Fuente funcional: PID §5.4 (form), §5.5 (vista pública), §6.3
> (qué se puntuará en hito 11 — aquí NO se puntúa), §4.2 (tablas
> `initial_predictions` y `group_qualification_predictions`).
> Bootstrap: `context/plan/08-bootstrap-prompt.md`.

---

## 0. Resumen ejecutivo

Cada usuario registra **una vez** (editable hasta un lock global del
torneo) sus predicciones iniciales:

- **Campeón** y **subcampeón** → select sobre `teams` del torneo.
- **Pichichi** y **mejor jugador** → **texto libre** (deuda D2: no
  hay tabla `players`; se valida a mano en hito 11). 
- **Clasificados de grupo** → por cada grupo A–H, el 1.º y el 2.º
  clasificado (`group_qualifiers_per_group = 2`), capturando la
  posición.

Más una **vista pública comparativa** (`/predictions/initial/public`)
con una card por usuario y un dropdown por categoría, visible solo
cuando las predicciones están bloqueadas globalmente.

Sin scoring (eso es hito 11). Tres entregables que requieren tu visto
bueno antes de tocar nada: (1) la **migración SQL** de D2 + lock +
RLS pública, (2) las **decisiones D08-1..D08-8**, (3) la ruta en
inglés vs español.

Importante! el usuario podrá cambiar predicciones iniciales (campeon, subcampeon, pichichi y mejor jugador, y también las predicciones de quién se clasificará en cada grupo) siempre y cuando no haya empezado NINGUN partido del torneo todavía, de modo que la fecha del primer partido del torneo marca cuando estos campos ya NO se pueden cambiar, así evitamos que los jugadores hagan trampa pero dejamos que cambien estas predicciones si el torneo aún no ha empezado



---

## 1. Estado verificado de la BD (local, leído hoy)

```
tournaments: wc_2022_test · active · predictions_open_until = NULL
             · group_qualifiers_per_group = 2
teams:       32 · grupos A–H, 4 equipos por grupo
players:     0   ← D2: tabla vacía, permanece vacía
initial_predictions: 0   group_qualification_predictions: 0
fixtures:    56 local (48 grupos + 8 octavos solo-local) / 48 prod
min(kickoff_at) = 2026-06-11 20:00Z  → lock = 11/06/2026 22:00 Madrid
            (= primer partido del torneo; hoy 2026-05-15 → abierto)
stages: group_stage, round_of_16, quarter_final, semi_final,
        third_place, final
```

`initial_predictions` hoy (migración `..._predictions.sql`):
`champion_team_id`, `runner_up_team_id` → FK `teams` (OK);
`top_scorer_player_id`, `best_player_id` → FK `players` (**inservible**,
D2); `unique (tournament_id, user_id)`.

`group_qualification_predictions`: `(tournament_id, user_id,
group_code, team_id)` único, `predicted_position int` con
`check (1..4)`.

RLS actual de ambas: `select own_or_admin`, `insert/update/delete
own` (**sin** check de lock), `admin_all`. La vista pública y el lock
en write **no existen aún** — se crean en este hito.

---

## 2. Decisiones a confirmar (D08-x)

Vinculantes una vez aprobadas. Marco mi recomendación.

- **D08-1 · D2 → texto libre, columnas nuevas, drop de las FK.**
  La migración hace `drop column top_scorer_player_id`,
  `drop column best_player_id` y añade `top_scorer_text text` y
  `best_player_text text` (nullable, `check` de longitud `<= 80`,
  trim en app). Justificación: ambas tablas están vacías (0 filas),
  no hay backfill; dejar las FK muertas confunde a hito 11 y a los
  tipos generados. Alternativa descartada: tabla aparte
  `initial_prediction_free_picks` (overkill para 2 strings).

- **D08-2 · Lock global del torneo = `predictions_open_until` si está
  seteado; si es NULL, `min(fixtures.kickoff_at)` (el kickoff del
  primer partido del torneo) calculado on-the-fly.** Decisión del
  usuario: las predicciones iniciales se pueden cambiar mientras NO
  haya empezado ningún partido; en cuanto arranca el primer partido,
  se congelan (evita trampas, pero deja editar si el torneo no ha
  empezado). NO se resta el margen de 24h aquí (ese margen es para
  predicciones de partido, hito 09). Se implementa como **función
  SQL**
  `public.initial_predictions_lock_at(uuid) → timestamptz` +
  `public.are_initial_predictions_locked(uuid) → boolean`,
  espejando el patrón ya existente `public.is_fixture_locked`. Una
  sola fuente de verdad (la usan RLS y la app vía `rpc`). El cálculo
  usa `now()` de Postgres → la función es `stable` (no `immutable`),
  igual que `is_fixture_locked`.

- **D08-3 · El lock se aplica en RLS (defensa real) además de en la
  UI.** Espejo de `match_predictions`: las policies `insert/update/
  delete own` de `initial_predictions` y `group_qualification_
  predictions` pasan a exigir `not are_initial_predictions_locked
  (tournament_id)`. El `admin_all` sigue bypass. Esto obliga a
  **drop + recreate** de esas policies en la migración nueva.

- **D08-4 · Vista pública = visible cuando el torneo está bloqueado.**
  La policy `select` de ambas tablas pasa a:
  `user_id = auth.uid() OR are_initial_predictions_locked
  (tournament_id) OR is_admin()`. Es decir: tus predicciones siempre
  las ves; las de los demás, solo tras el lock. Coherente con cómo
  `match_predictions` abre la lectura tras `is_fixture_locked`.

- **D08-5 · Clasificados de grupo: multi-choice de exactamente 2, sin
  orden** (revisión del usuario, sustituye a la versión 1.º/2.º).
  Por grupo se muestran los 4 equipos como **checkboxes**; hay que
  marcar **exactamente 2** (`GROUP_QUALIFIERS`). El orden NO se
  predice → se guardan 2 filas en `gqp` con `predicted_position =
  null` (la columna ya es nullable; **no requiere migración**).
  Validación: 0, 1 o 3+ marcados en cualquier grupo = error que
  nombra el grupo. Cada equipo debe pertenecer a su grupo.

- **D08-6 · Guardado parcial parcial.** Campeón, subcampeón, pichichi
  y mejor jugador son opcionales (se pueden dejar para luego, hasta
  el lock). **Los clasificados NO son parciales** (revisión D08-5):
  para guardar, los 8 grupos deben tener exactamente 2 equipos cada
  uno. Otras validaciones: `champion ≠ runner_up` si ambos puestos;
  longitudes de texto. `submitted_at` se sella en el primer guardado
  y se mantiene; `updated_at` lo lleva el trigger.

- **D08-7 · `group_qualification_predictions`: estrategia
  delete-then-insert por usuario.** Al guardar, se borran todas las
  filas `(tournament_id, user_id)` y se reinsertan las seleccionadas.
  Más simple y atómico que upsert con cambios de equipo/posición.
  Volumen trivial (≤16 filas por usuario).

- **D08-8 · Rutas en inglés, UI en español.** El bootstrap y el plan
  01 §7 mencionan `/predicciones/iniciales` pero también bendicen
  `app/(app)/predictions/initial/`. App Router liga carpeta↔URL: no
  se puede tener ambas sin rewrites. **Toda la app actual usa URLs en
  inglés** (`/dashboard`, `/admin/fixtures`, `/login`, `/rules`) con
  texto español. Por coherencia propongo
  **`/predictions/initial` y `/predictions/initial/public`**. Si
  prefieres URL en español lo cambio a carpetas
  `predicciones/iniciales` (trivial, dímelo en la revisión).

---

## 3. Migración SQL propuesta

Fichero nuevo (timestamp se genera con `npm run db:diff` o a mano
siguiendo la convención `YYYYMMDDHHMMSS_...`):
`supabase/migrations/<ts>_initial_predictions_freetext_and_lock.sql`.

```sql
-- ============================================================================
-- Migration: initial predictions — free-text scorer/best player + global lock
-- ----------------------------------------------------------------------------
-- 1. D2: players table stays empty. Replace the dead FK columns
--    top_scorer_player_id / best_player_id with free-text columns.
-- 2. Tournament-level lock for initial + group-qualification predictions:
--    predictions_open_until if set, else min(kickoff_at) — i.e. editable
--    until the tournament's first match kicks off.
-- 3. Make other users' initial predictions public once locked, and deny
--    writes past the lock at the RLS layer (mirrors match_predictions).
-- ============================================================================

-- ── 1. D2: free-text columns ────────────────────────────────────────────────
alter table public.initial_predictions
  drop column top_scorer_player_id,
  drop column best_player_id,
  add  column top_scorer_text text
       check (top_scorer_text is null or char_length(top_scorer_text) between 1 and 80),
  add  column best_player_text text
       check (best_player_text is null or char_length(best_player_text) between 1 and 80);

-- ── 2. Lock helper functions (mirror public.is_fixture_locked) ───────────────
create or replace function public.initial_predictions_lock_at(p_tournament_id uuid)
returns timestamptz
language sql
stable
as $$
  select coalesce(
    (select predictions_open_until
       from public.tournaments where id = p_tournament_id),
    (select min(kickoff_at)
       from public.fixtures where tournament_id = p_tournament_id)
  )
$$;

create or replace function public.are_initial_predictions_locked(p_tournament_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    now() >= public.initial_predictions_lock_at(p_tournament_id),
    false
  )
$$;

-- ── 3. RLS · initial_predictions (drop + recreate own/select policies) ───────
drop policy "initial_predictions_select_own_or_admin" on public.initial_predictions;
drop policy "initial_predictions_insert_own"          on public.initial_predictions;
drop policy "initial_predictions_update_own"          on public.initial_predictions;
drop policy "initial_predictions_delete_own"          on public.initial_predictions;

create policy "initial_predictions_select_own_or_locked_or_admin"
  on public.initial_predictions for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.are_initial_predictions_locked(tournament_id)
    or public.is_admin()
  );

create policy "initial_predictions_insert_own_unlocked"
  on public.initial_predictions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );

create policy "initial_predictions_update_own_unlocked"
  on public.initial_predictions for update to authenticated
  using (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  )
  with check (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );

create policy "initial_predictions_delete_own_unlocked"
  on public.initial_predictions for delete to authenticated
  using (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );
-- initial_predictions_admin_all: unchanged.

-- ── 3b. RLS · group_qualification_predictions (same shape) ───────────────────
drop policy "gqp_select_own_or_admin" on public.group_qualification_predictions;
drop policy "gqp_insert_own"          on public.group_qualification_predictions;
drop policy "gqp_update_own"          on public.group_qualification_predictions;
drop policy "gqp_delete_own"          on public.group_qualification_predictions;

create policy "gqp_select_own_or_locked_or_admin"
  on public.group_qualification_predictions for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.are_initial_predictions_locked(tournament_id)
    or public.is_admin()
  );

create policy "gqp_insert_own_unlocked"
  on public.group_qualification_predictions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );

create policy "gqp_update_own_unlocked"
  on public.group_qualification_predictions for update to authenticated
  using (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  )
  with check (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );

create policy "gqp_delete_own_unlocked"
  on public.group_qualification_predictions for delete to authenticated
  using (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );
-- gqp_admin_all: unchanged.
```

Notas:

- `delete-then-insert` (D08-7) necesita que el `delete own` funcione
  mientras no haya lock; con la policy de arriba, OK.
- Las funciones quedan accesibles vía PostgREST `rpc` para el rol
  `authenticated` (funciones `public` ejecutables por defecto; no se
  hace `revoke`). Lo verifico en el smoke test (`supabase.rpc(...)`).
- **No** se modifica `..._predictions.sql` ya aplicado. Migración
  nueva, aditiva salvo el `drop column` de D2 (necesario y sobre
  tabla vacía).
- Tras aplicar: `npm run db:reset` (local) → revisar en Studio →
  con tu OK, `npm run db:push` (prod) → `npm run types:gen`.
  `database.types.ts` perderá las relaciones a `players` y ganará
  `top_scorer_text`/`best_player_text`.

---

## 4. Lógica de lock en la app

Helper nuevo `src/lib/predictions/initialLock.ts` (server-only):

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getInitialLockState(tournamentId: string) {
  const supabase = await createClient();
  const [{ data: lockAt }, { data: locked }] = await Promise.all([
    supabase.rpc("initial_predictions_lock_at", { p_tournament_id: tournamentId }),
    supabase.rpc("are_initial_predictions_locked", { p_tournament_id: tournamentId }),
  ]);
  return { lockAt: (lockAt as string | null) ?? null, locked: locked === true };
}
```

Ventaja: el estado de lock lo decide Postgres (`now()` del servidor
DB), no `Date.now()` en el componente → **esquiva el gotcha Next 16
`react-hooks/purity`** sin `connection()` ni `eslint-disable`. Una
sola verdad, alineada con la RLS.

`lockAt` se muestra en UI con `formatMadridDateTime` (helper hito 07).

---

## 5. Rutas, páginas y componentes

```
src/app/(app)/predictions/initial/
  page.tsx            ← form editable / lectura si locked (requireAuth)
  actions.ts          ← saveInitialPredictions (server action)
  schemas.ts          ← Zod
  public/
    page.tsx          ← vista pública (solo si locked)
src/lib/predictions/
  initialLock.ts      ← helper de lock (rpc)
```

### 5.1 `/predictions/initial` — formulario

Server Component, `requireAuth()` + `getDefaultTournament()`.
Carga: teams del torneo (32, ordenados por `display_name`, con
`group_code`), la fila `initial_predictions` del usuario (si existe)
y sus `gqp`, y `getInitialLockState`.

- **Si `locked`**: render **solo lectura** (NO redirect — gotcha Next
  16 de streaming, bootstrap §). Muestra lo que el usuario guardó,
  un `Badge` "Bloqueado", la fecha de cierre, y un link a la vista
  pública. Sin `<form>`.
- **Si abierto**: `<form action={saveInitialPredictions}>` (server
  action, sin client component — patrón `/rules`, `/admin/fixtures`):
  - Campeón: `<select name="champion_team_id">` (opción vacía + 32).
  - Subcampeón: idem `name="runner_up_team_id"`.
  - Pichichi: `<input type="text" name="top_scorer_text" maxLength=80>`.
  - Mejor jugador: `<input type="text" name="best_player_text">`.
  - Clasificados: por cada grupo A–H un `<fieldset>` con los 4
    equipos como checkboxes `qual_<G>` (multi-choice); hay que marcar
    exactamente 2 (sin orden).
  - Banner `?ok=` / `?error=` (mismo patrón que el resto).
  - Aviso visual: "Podrás editar hasta el DD/MM/YYYY · HH:MM
    (Madrid). Después solo lectura."

### 5.2 `actions.ts` — `saveInitialPredictions(formData)`

1. `requireAuth()`; `getDefaultTournament()`.
2. Re-chequear `getInitialLockState`; si `locked` → redirect
   `?error=Las predicciones ya están bloqueadas` (defensa además de
   RLS).
3. Parsear con Zod (`readInitialPayload`, coerción de `FormData`).
4. Validación cruzada: `champion ≠ runner_up` (si ambos);
   por grupo, las dos posiciones o ambas vacías o ambas con equipos
   distintos del grupo correcto; equipos pertenecen al torneo.
5. `upsert` en `initial_predictions` `onConflict (tournament_id,
   user_id)` con `submitted_at = coalesce(existente, now())`.
6. `gqp`: `delete` por `(tournament_id, user_id)` + `insert` de las
   filas no vacías (`predicted_position` 1/2).
7. Usa el **server client** (RLS: el usuario solo escribe lo suyo y
   solo si no hay lock). Sin admin client.
8. `revalidatePath` de las dos rutas + `redirect(?ok=saved)`.

### 5.3 `/predictions/initial/public` — vista pública

Server Component, `requireAuth()` + `getInitialLockState`.

- **Si NO `locked`**: render informativo (NO redirect): "Las
  predicciones se harán públicas cuando se cierren, el DD/MM/YYYY ·
  HH:MM." + link a `/predictions/initial`.
- **Si `locked`**: query (server client; la RLS nueva ya autoriza
  leer las de todos tras el lock) de todas las `initial_predictions`
  + `gqp` del torneo, join a `profiles` (display_name, initials) y
  `teams` (display_name). Render:
  - Selector de **categoría** vía `searchParams` (`?cat=`):
    `campeon | subcampeon | pichichi | mejor_jugador | clasificados`
    (form GET con botón, patrón filtros de `/admin/fixtures`; sin JS).
  - **Una card por usuario** (scroll vertical, NO dropdown de
    usuarios — PID §5.5), mostrando el valor de la categoría
    seleccionada. Para `clasificados`: por grupo, 1.º y 2.º.
  - Usuarios sin predicción: card con "— sin predicción —".

### 5.4 Navegación

- `Header.tsx`: añadir para usuarios logueados un link
  "Predicciones" → `/predictions/initial`.
- `dashboard/page.tsx`: tarjeta/link a predicciones iniciales y a la
  vista pública. (Mínimo, coherente con el placeholder actual.)

---

## 6. Zod (`schemas.ts`)

```ts
const Uuid = z.string().uuid();
const FreeText = z.string().trim().min(1).max(80).nullable();

export const InitialPredictionSchema = z.object({
  champion_team_id: Uuid.nullable(),
  runner_up_team_id: Uuid.nullable(),
  top_scorer_text: FreeText,
  best_player_text: FreeText,
  // qualifiers: por grupo, array de team_ids (checkboxes, getAll)
  qualifiers: z.array(z.object({
    group_code: z.enum(GROUP_CODES),
    team_ids: z.array(Uuid),
  })),
});
```

Cruzadas (en el action, dependen de la BD): `champion ≠ runner_up`;
exactamente `GROUP_QUALIFIERS` (2) por grupo en los 8 grupos; cada
team pertenece a su `group_code` y al torneo. `predicted_position`
se guarda `null` (sin orden). Mensajes de error en español.

---

## 7. Pasos de ejecución

1. **Migración** (este plan §3). Crear fichero, `npm run db:reset`
   local, revisar en Studio (`\d initial_predictions`, probar las
   funciones `rpc`), enseñarte el diff. **Con tu OK**: `db:push`
   prod + `npm run types:gen` + commit.
2. Helper `src/lib/predictions/initialLock.ts`.
3. `schemas.ts` + `actions.ts` (esqueleto → completo).
4. `/predictions/initial` page (form + modo lectura por lock).
5. `/predictions/initial/public` page + dropdown de categoría.
6. Nav: Header + dashboard.
7. `npm run typecheck && npm run lint && npm run format:check &&
   npm run build`. Arreglar lo que salte.
8. Smoke local con David1/David2 (§8). Commits por unidad coherente,
   push a master (Vercel autodeploy).
9. Bitácora `context/implementations/08-initial-predictions-implementation.md`
   en paralelo desde el paso 1.

Migración a prod: te pido confirmación explícita antes de `db:push`
(es cambio destructivo de columnas, aunque sobre tabla vacía).

---

## 8. Pruebas (local, David1 admin / David2 player)

- David2 entra a `/predictions/initial` (abierto hoy): guarda
  campeón, subcampeón, pichichi "Messi", mejor jugador, y A–H
  clasificados con posición. Recarga: persiste.
- David1 guarda predicciones distintas.
- `/predictions/initial/public` antes del lock → mensaje "no
  disponible aún", sin filtrar datos de otros (verificar que la query
  no devuelve filas ajenas: RLS).
- Forzar lock: `update tournaments set predictions_open_until =
  now() - interval '1 min'` (psql). Recargar:
  - `/predictions/initial` → modo lectura, sin form, badge
    "Bloqueado".
  - Intento de POST directo al action → rechazado (RLS + check app).
  - `/predictions/initial/public` → cards de David1 y David2,
    dropdown de categoría funciona.
  - Revertir: `update tournaments set predictions_open_until =
    null`.
- Validaciones: campeón = subcampeón → error; grupo con 0/1/3+
  marcados → error nombrando el grupo; equipo de otro grupo → error.
- `requireAuth`: anónimo en `/predictions/initial` → `/login`.

> Nota: los 8 octavos solo-local no afectan al lock (min(kickoff) es
> un partido de grupos, anterior). No se borran (bootstrap §).

---

## 9. Acceptance criteria

- [ ] Migración aplicada local+prod; `types:gen` regenerado;
      `top_scorer_text`/`best_player_text` en los tipos; sin FK a
      `players` en `initial_predictions`.
- [ ] Funciones `initial_predictions_lock_at` /
      `are_initial_predictions_locked` existen y se consultan vía
      `rpc`.
- [ ] `/predictions/initial`: form completo con campeón, subcampeón,
      pichichi/mejor jugador (texto), clasificados 1.º/2.º por grupo.
      Guarda y reedita hasta el lock. Guardado parcial OK.
- [ ] Tras el lock: `/predictions/initial` es solo lectura (sin
      redirect), y la RLS rechaza writes.
- [ ] `/predictions/initial/public`: oculta antes del lock; tras el
      lock, una card por usuario + dropdown por categoría (PID §5.5).
- [ ] Validaciones cruzadas (campeón≠subcampeón, 1.º≠2.º, pertenencia
      a grupo/torneo) con mensajes en español.
- [ ] `player` no ve predicciones ajenas antes del lock (RLS).
- [ ] UI en español, coherente con `/rules`, `/admin/fixtures`.
      Reutiliza `getDefaultTournament`, `madridTime`, `Badge`.
- [ ] `typecheck`/`lint`/`format:check`/`build` verdes.
- [ ] Probado local con David1/David2; push a master desplegado.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| `drop column` borra datos | Tablas vacías hoy (verificado: 0 filas). Confirmas antes de `db:push`. |
| `rpc` no expuesto a `authenticated` | Funciones `public` ejecutables por defecto; smoke test lo verifica antes de seguir. |
| Lock mal calculado por TZ | El lock lo computa Postgres con `timestamptz` (UTC); la UI solo formatea a Madrid con `Intl`. Sin offsets hardcoded. |
| `redirect()` en server component streaming (gotcha hito 07) | Estado bloqueado/no-disponible se **renderiza en modo lectura**, no se redirige. |
| `Date.now()` → `react-hooks/purity` | Lock vía `rpc` (now() de la DB); no se usa `Date.now()` en el componente. |
| RLS recreada rompe `match_predictions` | La migración solo toca policies de `initial_predictions` y `gqp`; `match_predictions` no se toca. |
| 8 octavos solo-local alteran `min(kickoff)` | Son posteriores al primer partido de grupos; `min` no cambia. No se borran. |

---

## 11. Lo que NO entra

- Scoring de predicciones iniciales (hito 11).
- Gestión de jugadores / autocompletar pichichi (D2: texto libre).
- Selector de torneo (sigue `wc_2022_test`, DH7-7).
- Vista pública de predicciones de partidos (hito 09).
- Editar el lock desde UI admin (se setea `predictions_open_until`
  por SQL si hace falta; UI admin de esto sería hito 14).

---

Cuando lo revises y me digas "adelante", empiezo por el paso 1
(migración) y abro la bitácora en
`context/implementations/08-initial-predictions-implementation.md`.
