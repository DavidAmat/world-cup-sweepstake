Hola. Continuamos un proyecto a mitad: una app web privada para gestionar
una porra del Mundial de fútbol 2026 entre 10 amigos. Llevamos 9 hitos
cerrados (02-09). Ahora toca el hito 10: panel admin para introducir
resultados de partidos (marcador, goleadores, prórroga, penaltis) y
disparar el recálculo del torneo.

UI en español. Código, SQL y nombres de tabla en inglés. Comunícate
conmigo en español.

# QUÉ HITO ES Y DÓNDE ESTÁ DEFINIDO TÉCNICAMENTE

- **Hito 10 — Admin: introducción de resultados.**
- Definición técnica de alto nivel (fuente para el plan detallado):
  - `context/plan/01-plan.md` §7, sección "Hito 10 — Admin: introducción
    de resultados" (scope, esqueleto, acceptance).
  - `context/initial-setup/02-pid.md`: §4.2 (tablas `match_results`,
    `match_goals`, `player_match_stats`), §5.6 (flujo admin de
    resultados), §6 (reglas de puntuación — el motor es el hito 11,
    aquí solo se capturan los datos).
- El **plan detallado lo escribes tú** al empezar, en
  `context/plan/10-admin-results-entry.md` (NO existe aún; crearlo es
  tu primer entregable). Yo lo reviso y te digo "adelante".
- La bitácora se va llenando **en paralelo** en
  `context/implementations/10-admin-results-entry-implementation.md`.

# LEE ESTO ANTES DE NADA

En este orden, hasta entender el estado actual:

1. `context/initial-setup/02-pid.md` — Project Initiation Document.
   Fuente de verdad funcional. Mira §4.2 (tablas de resultados),
   §5.6 (flujo admin), §6 (scoring — solo para entender qué datos
   necesita el motor del hito 11).
2. `context/plan/01-plan.md` — índice maestro. Lee §6 (roadmap) y
   §7 hito 10.
3. Bitácoras más relevantes (patrones que reutilizarás):
   - `context/implementations/09-match-predictions-implementation.md`
     (CERRADO — patrón de server actions, upsert, validación Zod,
     cliente component `MatchesForm.tsx`).
   - `context/implementations/07-admin-fixtures-implementation.md`
     (CERRADO — patrones de páginas admin, `ImportClient.tsx` como
     precedente de client component en admin).

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
  `is_fixture_locked(uuid)` (= `app_now() >= kickoff_at - 24h`),
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
  - `/predictions/initial` (form / solo lectura si lock — NO redirect)
    y `/predictions/initial/public` (card por usuario + dropdown
    por categoría, oculta hasta el lock).
  - `src/lib/predictions/initialLock.ts`: estado de lock vía `rpc`.
  - Migración `20260515120000`: `initial_predictions` con texto libre
    (`top_scorer_text` / `best_player_text`); funciones
    `initial_predictions_lock_at()` / `are_initial_predictions_locked()`.
  - Migración `20260516120000` — `FECHA_ACTUAL` / `app_now()`:
    tabla `app_settings` (fila única `fecha_actual`), función
    `public.app_now() = coalesce(app_settings.fecha_actual, now())`.
    La app sincroniza desde env `FECHA_ACTUAL`
    (`src/lib/dates/appNow.ts`, service-role). Banner "🧪 Fecha
    simulada" en páginas. `make fecha FECHA=<v>` / `make fecha FECHA=`.
  - Clasificados de grupo: multi-choice (checkboxes), exactamente 2
    por grupo, sin orden.
  - **Lección dura**: scripts de verificación throwaway NUNCA borran
    por `tournament_id`; solo filas que crean, acotadas por `user_id`
    de test.

Hito 09 — Predicciones de partidos (CERRADO)
  Plan: `context/plan/09-match-predictions.md`
  Bitácora: `context/implementations/09-match-predictions-implementation.md`
  - Migración `20260517120000`: `is_fixture_locked` repuntado a
    `app_now()` → `FECHA_ACTUAL` simula también el lock de partido.
  - Migración `20260517130000`: eliminado CHECK que ataba
    `predicts_extra_time` a la presencia de goles a 120'.
    Columnas `home/away_goals_120` conservadas (nullable, siempre NULL
    en predicciones); `check1` (penaltis⇒prórroga) conservado.
  - `src/lib/predictions/matchLock.ts`: `getMatchLockState()` =
    un único `rpc("app_now")` + `isFixtureLocked(kickoffIso, appNowIso)`
    en JS (= appNow ≥ kickoff − 24h). Sin `Date.now()` en server
    component (esquiva `react-hooks/purity`).
  - `src/app/(app)/predictions/matches/schemas.ts`: Zod con
    `superRefine` que espeja los CHECK de `match_predictions` +
    invariantes (penaltis⇒prórroga; prórroga⇒empate 90'; knockout
    draw⇒prórroga obligatoria; el que pasa ∈{home,away}).
  - `actions.ts`: `saveAllMatchPredictions` (requireAuth, todos los
    fixtures del torneo, skip locked/sin-equipos/vacíos, upsert masivo
    `onConflict fixture_id,user_id`). `generateRandomMatchPredictions`
    (requireAuth; dado 40%/30%/30%; knockout draw⇒ET+70%pen+50/50
    ganador).
  - `MatchesForm.tsx` (`"use client"`): client component con
    `useState`/`useMemo`; función `derive(values, meta)` centraliza
    la lógica derivada (ET automático en knockout draw, `qual`
    automático si no empate, `pen=false` si !ET); badge
    Guardado/Sin guardar/Bloqueado por fixture; sticky bar con
    contador + botón global. Patrón: disabled checkbox/select no
    se postea → `<input type="hidden">` para ET y qual automático.
  - `/predictions/matches/page.tsx`: server component que arma
    `RoundVM[]` (todas las jornadas apiladas, pills ancla #r-{code},
    scroll-mt-32). Botón "🎲 Generar predicciones aleatorias"
    visible para TODOS los usuarios autenticados.
  - `/predictions/matches/public/page.tsx`: selector de ronda,
    card por usuario por fixture bloqueado (RLS oculta lo no
    bloqueado).
  - Nav: `Header.tsx` +link "Partidos"; `dashboard` +2 tarjetas.

# DECISIONES CERRADAS QUE AFECTAN AL HITO 10

Vinculantes. No las cuestiones sin un motivo muy fuerte.

- **Las tablas `match_results`, `match_goals` y `player_match_stats`
  YA EXISTEN** (migración `20260508164810`). No las recrees. Revisa
  su estructura antes de escribir el plan.
- **`match_results` es 1:1 con `fixture`**: `unique (fixture_id)`,
  `home_goals_90`, `away_goals_90`, `extra_time`, `home_goals_120`,
  `away_goals_120`, `penalties`, `winner_team_id`. Estado: `draft` →
  `confirmed`.
- **`match_goals`**: `fixture_id`, `team_id`, `player_id` (nullable:
  autogol o jugador sin asignar), `minute` (nullable), `is_own_goal`,
  `is_penalty`. Un insert por gol.
- **`player_match_stats`**: opcional/progresivo. No bloquea el hito.
- **Admin gate**: rutas `/admin/*` gateadas en `src/proxy.ts`; en
  server components y actions usa `requireAdmin()`.
- **Sin scoring aquí** (es el hito 11). El hito 10 solo captura
  y persiste; la acción "confirmar" simplemente cambia el estado a
  `confirmed` y llama (de momento vacío) al stub del recálculo.
- **Reutiliza**: `getDefaultTournament`, `madridTime`, `Badge`,
  `requireAdmin`, el patrón de upsert masivo de `actions.ts` del 09,
  y el patrón "render read-only si estado=confirmed, no redirect".

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
  ...20260516120000_app_now_override,
  ...20260517120000_is_fixture_locked_app_now,
  ...20260517130000_match_predictions_drop_120.
  Tras cualquier migración nueva: `npm run types:gen` y luego
  `npx prettier --write src/lib/supabase/database.types.ts` (el
  fichero autogenerado no sale prettier-clean; formatéalo para que
  `format:check` quede verde).

Datos cargados:
  - **Prod**: torneo `wc_2022_test` (active), 32 teams, 48 fixtures
    de grupos, 56 predicciones de partido (de los smokes del hito 09).
    Sin match_results. Sin predicciones iniciales (las pruebas fueron
    en local).
  - **Local**: lo mismo + 8 octavos `wc2022_r16_*` (solo local,
    placeholders). Predicciones de partido de los 3 usuarios de test.
    `FECHA_ACTUAL` probablemente en null (hora real); ajustar con
    `make fecha` si necesitas simular partidos bloqueados para probar
    que admin puede/no puede editar resultados de un fixture locked.

Gotchas Next 16 ya resueltos (replícalos, no los redescubras):
  - `redirect()` en server component streaming mis-resuelve paths.
    Gates en `proxy.ts`; estados read-only se renderizan, no se
    redirige.
  - `Date.now()`/`Math.random()` en server components →
    `react-hooks/purity`. Usa el lock vía `rpc` (app_now() de la DB).
  - `<html>` lleva `suppressHydrationWarning` (extensiones). No lo
    quites.
  - Migración local: `npx supabase migration up --local` (NO
    `db:reset`, que vacía la DB). A prod: `echo y | npx supabase db
    push --linked`; verificar con `npx supabase migration list
    --linked`.
  - Commits: máximo 1 línea, Conventional Commits en inglés,
    `Co-Authored-By: Claude`. Push directo a master.

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

# TAREA: HITO 10 — ADMIN: INTRODUCCIÓN DE RESULTADOS

Objetivo: el admin introduce manualmente el resultado de cada partido
(goles a 90', prórroga, goles a 120', penaltis, equipo que pasa,
lista de goleadores) y confirma. Al confirmar, el resultado queda en
estado `confirmed` y se dispara un stub de recálculo (vacío por ahora;
el motor real es el hito 11).

Pasos generales (sujetos a tu plan detallado en
`context/plan/10-admin-results-entry.md`):

1. Leer PID §4.2, §5.6 y `01-plan.md` §7 hito 10. Inspeccionar la
   estructura actual de `match_results`, `match_goals`,
   `player_match_stats` en local (psql o Studio).
2. Proponer en el plan: estructura de la página `/admin/results`
   (selector de jornada/ronda → lista de fixtures), formulario por
   fixture (inline o página separada), gestión de `draft`→`confirmed`,
   cómo manejar la lista de goleadores (jugador + equipo + minuto +
   flags), y el stub de recálculo.
3. Migración si necesaria (p.ej. añadir columna `status` a
   `match_results` si no existe, o ajustar algún CHECK). Aplicar local
   y tras confirmación a prod.
4. Server actions en `src/app/admin/results/actions.ts`:
   `saveMatchResult` (draft, upsert `match_results` + replace
   `match_goals`), `confirmMatchResult` (draft→confirmed + stub
   recálculo).
5. Páginas `/admin/results` y `/admin/results/[fixtureId]` (o
   formulario inline, según lo que decidas en el plan).
6. Vista read-only cuando el resultado ya esté `confirmed` (patrón
   del hito 09: no redirect, renderiza en modo lectura).
7. Navegación: añadir "Resultados" a `/admin` nav / sidebar.
8. typecheck/lint/format/build verdes. Smoke local. Push master.
9. Bitácora en paralelo desde el paso 1.

# CÓMO TRABAJAS CONMIGO

- Primero escribes el plan detallado en
  `context/plan/10-admin-results-entry.md`. Yo lo reviso y te digo
  "adelante" (o ajustes).
- Bitácora en paralelo en
  `context/implementations/10-admin-results-entry-implementation.md`,
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

1. Lee "LEE ESTO ANTES DE NADA" (sobre todo PID §4.2/§5.6 y la
   bitácora del hito 09).
2. Inspecciona el estado: `npm run db:status`, mira `match_results` /
   `match_goals` / `player_match_stats` en Studio o psql.
3. Escribe el plan detallado del hito 10 en
   `context/plan/10-admin-results-entry.md`. No implementes todavía.
4. Pídeme aprobación.
5. Aprobado, ejecuta paso a paso siguiendo las convenciones de los
   hitos previos.
