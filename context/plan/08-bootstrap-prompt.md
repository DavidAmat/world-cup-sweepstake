Hola. Continuamos un proyecto a mitad: una app web privada para gestionar
una porra del Mundial de fútbol 2026 entre 10 amigos. Llevamos 7 hitos
cerrados (02-08). Ahora toca el hito 09: predicciones de partidos
(fase de grupos y eliminatorias) con su vista pública y bloqueo 24h
antes de cada partido.

UI en español. Código, SQL y nombres de tabla en inglés. Comunícate
conmigo en español.

# QUÉ HITO ES Y DÓNDE ESTÁ DEFINIDO TÉCNICAMENTE

- **Hito 09 — Predicciones de partidos.**
- Definición técnica de alto nivel (fuente para el plan detallado):
  - `context/plan/01-plan.md` §7, sección "Hito 09 — Predicciones de
    partidos" (scope, validación cruzada Zod, acceptance).
  - `context/initial-setup/02-pid.md`: §5.7 (predicciones de
    partidos: grupos vs eliminatorias), §5.8 (vista pública de
    partidos), §4.4 (regla de bloqueo: `now >= kickoff_at - 24h`),
    §4.2 (tabla `match_predictions`), §6.2 (criterios que se
    puntuarán en hito 11 — NO se implementa scoring aquí).
- El **plan detallado lo escribes tú** al empezar, en
  `context/plan/09-match-predictions.md` (NO existe aún; crearlo es
  tu primer entregable, igual que en 07/08). Yo lo reviso y te digo
  "adelante".
- La bitácora se va llenando **en paralelo** en
  `context/implementations/09-match-predictions-implementation.md`.

# LEE ESTO ANTES DE NADA

En este orden, hasta entender el estado actual:

1. `context/initial-setup/02-pid.md` — Project Initiation Document.
   Fuente de verdad funcional. Mira §5.7, §5.8, §4.4, §4.2, §6.2.
2. `context/plan/01-plan.md` — índice maestro de los 17 hitos. Lee §6
   (roadmap) y §7 (resumen por hito, sobre todo Hito 09).
3. Bitácoras de los hitos cerrados. La del **08 es crítica**
   (patrones que reutilizas casi tal cual en el 09):
   - `context/implementations/06-seed-and-import-master-data-implementation.md`
   - `context/implementations/07-admin-fixtures-implementation.md`
   - `context/implementations/08-initial-predictions-implementation.md`
4. Planes detallados 07 y 08 (modelo de datos y decisiones vivas):
   - `context/plan/07-admin-fixtures.md`
   - `context/plan/08-initial-predictions.md`

# RESUMEN DE LOS HITOS CERRADOS

Hito 02 — Project setup
  Next.js 16 + TS + Tailwind v4 + ESLint + Prettier + Turbopack.
  src/{app,components,lib,styles}. Deps: @supabase/ssr,
  @supabase/supabase-js, zod, react-hook-form, lucide-react, date-fns.

Hito 03 — Supabase local + migraciones
  Supabase CLI. Clientes en src/lib/supabase/{client,server,admin}.ts.
  `src/proxy.ts` (Next 16 renombró middleware→proxy) refresca sesión.

Hito 04 — Esquema de BD
  Migraciones SQL → 17 tablas. Helpers SQL: `is_admin()`,
  `is_fixture_locked(uuid)` (= `now() >= kickoff_at - 24h`),
  `set_updated_at()`. RLS local+prod.

Hito 05 — Auth + profiles + roles
  Trigger `handle_new_user`. Páginas /login /register /rules.
  `requireAuth()` / `requireAdmin()` en src/lib/permissions/.

Hito 06 — Seeds e importación de master data
  `data/seeds/wc_2022/`. Scripts `wc2022:upload/download` (tsx+Zod).
  48 partidos de grupos, fechas a junio 2026 18:00 Madrid.

Hito 07 — Admin: fixtures (CERRADO)
  `/admin/fixtures` (listado/editar/crear/import JSON). Helpers
  reutilizables: `src/lib/dates/madridTime.ts`,
  `src/lib/tournament/getDefaultTournament.ts`,
  `src/lib/fixtures/{pythonFormat,catalogs}.ts`,
  `src/components/ui/Badge.tsx`. Gate de `/admin/*` en `src/proxy.ts`
  (redirect de servidor; NO `redirect()` en server component
  streaming). Gotcha Next 16 `react-hooks/purity` con `Date.now()`.

Hito 08 — Predicciones iniciales (CERRADO)
  Plan: `context/plan/08-initial-predictions.md`
  Bitácora: `context/implementations/08-initial-predictions-implementation.md`
  Qué hay (reutilízalo en el 09):
  - Páginas player: `/predictions/initial` (form / **solo lectura
    cuando hay lock — NO redirect**) y `/predictions/initial/public`
    (card por usuario + dropdown por categoría, oculta hasta el lock).
    Rutas en inglés, UI en español, bajo `src/app/(app)/predictions/`.
  - `src/lib/predictions/initialLock.ts`: estado de lock vía `rpc`
    (lo decide Postgres, no `Date.now()` → esquiva
    `react-hooks/purity` sin `connection()`). **Replica este patrón
    para el lock por fixture del hito 09.**
  - **Migración `20260515120000`**: `initial_predictions` pasó a
    texto libre (`top_scorer_text`/`best_player_text`, se eliminó la
    deuda D2 de `players`); funciones
    `initial_predictions_lock_at()` / `are_initial_predictions_locked()`;
    RLS: ves lo tuyo siempre, lo de los demás solo tras el lock,
    writes denegados pasado el lock.
  - **Migración `20260516120000` — `FECHA_ACTUAL` / `app_now()`**:
    tabla `app_settings` (fila única `fecha_actual`), función
    `public.app_now()` = `coalesce(app_settings.fecha_actual,
    now())`. `are_initial_predictions_locked` compara contra
    `app_now()`. La app sincroniza `app_settings.fecha_actual` desde
    el env `FECHA_ACTUAL` (`src/lib/dates/appNow.ts`, service-role,
    solo si cambia). Banner "🧪 Fecha simulada" en las páginas.
    **Importante para el hito 09**: `is_fixture_locked(uuid)` aún usa
    `now()`, NO `app_now()`. Si quieres que `FECHA_ACTUAL` también
    simule el bloqueo de predicciones de partido (muy útil para
    probar), propón en el plan repuntar `is_fixture_locked` a
    `app_now()` (migración pequeña, mismo patrón).
  - `Makefile` con `make fecha FECHA=<v>` (reescribe `.env.local` y
    reinicia `npm run dev`). `make fecha FECHA=` vuelve a hora real.
  - Clasificados de grupo: multi-choice (checkboxes), exactamente 2
    por grupo, sin orden (`predicted_position = null`).
  - Lección dura (incidente del 08): **los scripts de verificación
    throwaway NUNCA borran por `tournament_id`**; solo filas que
    crean, acotadas por `user_id` de test. No ejecutar borrados
    destructivos sin confirmar si puede haber datos del usuario.

# DECISIONES CERRADAS QUE AFECTAN AL HITO 09

Vinculantes. No las cuestiones sin un motivo muy fuerte.

- **La tabla `match_predictions` y su RLS YA EXISTEN**
  (migración `20260508164810_predictions.sql`). No la recrees. Tiene:
  `home_goals_90`, `away_goals_90`, `predicts_extra_time`,
  `home_goals_120`, `away_goals_120`, `predicts_penalties`,
  `predicted_winner_team_id`, `predicted_qualified_team_id`,
  `unique (fixture_id, user_id)`, y **CHECKs**: prórroga ⇔ goles 120
  presentes; penaltis ⇒ prórroga. RLS: `select` propia o
  `is_fixture_locked(fixture_id)` o admin; `insert/update/delete`
  propia y solo si NO `is_fixture_locked`; `admin_all`. Es decir, el
  hito 09 es **sobre todo UI + server actions + reutilización**, la
  capa DB ya está hecha (salvo el posible repunte a `app_now`).
- **Lock por fixture = `now() >= kickoff_at - 24h`** (PID §4.4), ya
  implementado en `is_fixture_locked`. La UI bloquea a las 24h; el
  server también valida antes del upsert; tras el lock la predicción
  se hace pública (RLS) y la página se renderiza en **modo lectura**
  (no redirect, gotcha de streaming).
- **Grupos vs eliminatorias** (PID §5.7): grupos → solo
  `home_goals_90`/`away_goals_90`. Eliminatorias → además toggle
  prórroga (+ goles 120), toggle penaltis, y equipo que pasa
  (`predicted_qualified_team_id`). Validación cruzada Zod espejando
  los CHECK de la tabla (no penaltis sin prórroga, etc.).
- **Fixtures con placeholders**: en local hay 8 octavos
  `wc2022_r16_*` con `home_placeholder`/`away_placeholder` y team_id
  null (los cruces no se conocen). Decide en el plan qué pasa al
  predecir un fixture sin equipos asignados (p.ej. permitir solo
  goles, o no permitir predicción hasta que el admin asigne equipos).
- **Sin scoring** (es hito 11). Aquí solo se capturan y muestran
  predicciones.
- Reutiliza: `getDefaultTournament`, `madridTime`, `Badge`, el
  patrón de `initialLock.ts` (rpc), `appNow`/`FECHA_ACTUAL`, el
  `Makefile`, y el patrón "render read-only si locked, no redirect".
  Gate de auth: `/admin/*` en `proxy.ts`; rutas de jugador con
  `requireAuth()`.

# ESTADO DE INFRAESTRUCTURA Y URLS
Repo:        github.com/DavidAmat/world-cup-sweepstake (público)
Branch:      master (commits directos a master, no PR)
Vercel:      https://world-cup-sweepstake-mu.vercel.app
Supabase:    project_ref qbphxsijmqortxhxlrnr (EU West, free tier)

Local Supabase (quirk Docker):
  - API/DB SOLO en 192.168.0.112 (NO 127.0.0.1).
  - `.env.local` apunta a `http://192.168.0.112:54321`. Si cambia la
    IP LAN (DHCP), actualizar `.env.local` Y `scripts/wc2022/lib/env.ts`.
  - Studio: http://192.168.0.112:54323
  - psql: PGPASSWORD=postgres psql -h 192.168.0.112 -p 54322 -U postgres -d postgres

Env vars (.env.local local / Vercel prod):
  NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ·
  SUPABASE_SECRET_KEY · NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2022_test
  **FECHA_ACTUAL** (testing): fecha simulada para el lock. Vacío =
  fecha real. Formatos: `2026-06-12`, `2026-06-12T09:00` (Madrid),
  ISO con Z/offset. Se sincroniza a `public.app_settings`. En prod
  NO está seteada (fecha real). Cambiarla → reiniciar dev (o
  `make fecha`).

Migraciones aplicadas (local Y prod):
  ...164810_predictions (match_predictions + RLS, ya existía),
  ...20260515120000_initial_predictions_freetext_and_lock,
  ...20260516120000_app_now_override.
  Tras cualquier migración nueva: `npm run types:gen` y luego
  `npx prettier --write src/lib/supabase/database.types.ts` (el
  fichero autogenerado no sale prettier-clean; formatéalo para que
  `format:check` quede verde).

Datos cargados:
  - **Prod**: torneo `wc_2022_test` (active), 32 teams, 48 fixtures
    de grupos. Sin match_results. Sin predicciones (las pruebas del
    08 fueron en local).
  - **Local**: lo mismo + 8 octavos `wc2022_r16_*` (solo local,
    placeholders). El usuario re-creó predicciones iniciales de test
    (2 `initial_predictions` + 32 `gqp`). `FECHA_ACTUAL` quedó en
    `2026-06-12T09:00` (torneo "empezado"): para probar el hito 09
    seguramente quieras `make fecha FECHA=` (hora real) o una fecha
    relativa a algún `kickoff_at`.

Gotchas Next 16 ya resueltos (replícalos, no los redescubras):
  - `redirect()` en server component streaming mis-resuelve paths.
    Gates en `proxy.ts`; estados read-only se renderizan, no se
    redirige.
  - `Date.now()`/`Math.random()` en server components →
    `react-hooks/purity`. Usa el lock vía `rpc` (now()/app_now() de
    la DB), como `initialLock.ts`.
  - `<html>` lleva `suppressHydrationWarning` (extensiones). No lo
    quites.
  - Migración local: `npx supabase migration up --local` (NO
    `db:reset`, que vacía la DB). A prod: `echo y | npx supabase db
    push --linked`; verificar con `npx supabase migration list
    --linked`.

# COMANDOS HABITUALES

  npm run dev                 # Next en localhost:3000
  npm run db:status / db:start / db:stop
  npx supabase migration up --local      # aplica migraciones nuevas (no destructivo)
  npm run types:gen           # regenera database.types.ts (tras migración)
  npx prettier --write src/lib/supabase/database.types.ts
  npm run typecheck && npm run lint && npm run format:check && npm run build
  make fecha FECHA=2026-06-12T09:00      # simular fecha + reiniciar dev
  make fecha FECHA=                      # volver a fecha real
  npm run wc2022:download     # diff read-only DB vs JSON local

A producción (pide confirmación antes):
  echo y | npx supabase db push --linked # migraciones (pide OK)
  git push origin master                 # Vercel autodeploya

# TAREA: HITO 09 — PREDICCIONES DE PARTIDOS

Objetivo: cada usuario predice cada partido (grupos: resultado a 90';
eliminatorias: + prórroga/penaltis/equipo que pasa), editable hasta
24h antes del kickoff; tras el lock, solo lectura y público. Sin
scoring (hito 11).

Pasos generales (sujetos a tu plan detallado en
`context/plan/09-match-predictions.md`):

1. Leer PID §5.7/§5.8/§4.4/§4.2/§6.2 y `01-plan.md` §7 hito 09.
2. Decidir y proponer (en el plan): ¿repuntar `is_fixture_locked` a
   `app_now()` para que `FECHA_ACTUAL` también simule el bloqueo de
   partidos? (recomendado, migración pequeña). Cómo tratar fixtures
   con placeholders. Estructura de `/predicciones/partidos` (selector
   de jornada/ronda, lista de fixtures con form inline).
3. Helper de lock por fixture (patrón `initialLock.ts`, vía `rpc`
   `is_fixture_locked`).
4. Página `/predictions/matches` (rutas en inglés, UI español):
   por jornada/ronda, form por fixture; grupos vs eliminatorias;
   validación Zod cruzada espejando los CHECK de `match_predictions`.
   Server action valida el lock antes del upsert.
5. Vista pública `/predictions/matches/public`: card por usuario por
   fixture, visible solo cuando el fixture está bloqueado (RLS ya lo
   permite).
6. UI coherente con `/predictions/initial`, `/rules`,
   `/admin/fixtures`. Reutiliza helpers existentes.
7. typecheck/lint/format/build verdes. Smoke local con David1/David2
   (usa `make fecha` para mover el lock). Push a master.
8. Bitácora en paralelo desde el paso 1.

# CÓMO TRABAJAS CONMIGO

- Primero escribes el plan detallado en
  `context/plan/09-match-predictions.md`. Yo lo reviso y te digo
  "adelante" (o ajustes).
- Bitácora en paralelo en
  `context/implementations/09-match-predictions-implementation.md`,
  no al final.
- Commits: 1 por unidad coherente. **Mensaje de commit: máximo 1
  línea**, Conventional Commits en inglés, `Co-Authored-By: Claude`.
  Push directo a master tras cada commit (no preguntes cada vez).
- Pide confirmación antes de: acciones destructivas, `db:push` de
  una migración a prod, crear/borrar recursos Supabase/Vercel,
  borrar datos con predicciones asociadas. NUNCA borrados por
  `tournament_id` en scripts de verificación.
- Si un comando bash necesita interacción humana (passwords, prompts
  Y/n, login), pásamelo y dime qué buscar.
- Si editas un fichero que yo (o un linter/prettier) modificó,
  vuelve a leerlo antes de tocarlo.
- Toda migración SQL: la propones, la reviso, la aplicas
  (migration up local → db:push prod tras OK), regeneras tipos y los
  formateas con prettier.

# EMPIEZA AQUÍ

1. Lee "LEE ESTO ANTES DE NADA" (sobre todo PID §5.7/§5.8/§4.4 y la
   bitácora del hito 08).
2. Inspecciona el estado: `npm run db:status`, mira
   `match_predictions` / `fixtures` / `app_settings` en Studio o
   psql. Comprueba `FECHA_ACTUAL` en `.env.local`.
3. Escribe el plan detallado del hito 09 en
   `context/plan/09-match-predictions.md` (incluida la propuesta de
   repuntar `is_fixture_locked` a `app_now()` y el trato de
   placeholders). No implementes todavía.
4. Pídeme aprobación.
5. Aprobado, ejecuta paso a paso siguiendo las convenciones de los
   hitos previos.
