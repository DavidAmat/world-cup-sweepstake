Hola. Continuamos un proyecto a mitad: una app web privada para gestionar
una porra del Mundial de fútbol 2026 entre 10 amigos. Llevamos 10 hitos
cerrados (02-10). Ahora toca el hito 11: motor de puntuación.

UI en español. Código, SQL y nombres de tabla en inglés. Comunícate
conmigo en español.

# QUÉ HITO ES Y DÓNDE ESTÁ DEFINIDO TÉCNICAMENTE

- **Hito 11 — Motor de puntuación.**
- Definición técnica de alto nivel (fuente para el plan detallado):
  - `context/plan/01-plan.md` §7, sección "Hito 11 — Motor de
    puntuación" (scope, esqueleto, acceptance).
  - `context/initial-setup/02-pid.md`: §4.2 (tablas `scoring_rules`,
    `prediction_scores`), §6 (sistema de puntuación completo: criterios
    y multiplicadores).
- El **plan detallado lo escribes tú** al empezar, en
  `context/plan/11-scoring-engine.md` (NO existe aún; crearlo es
  tu primer entregable). Yo lo reviso y te digo "adelante".
- La bitácora se va llenando **en paralelo** en
  `context/implementations/11-scoring-engine-implementation.md`.

# LEE ESTO ANTES DE NADA

En este orden, hasta entender el estado actual:

1. `context/initial-setup/02-pid.md` — §4.2 (tablas `scoring_rules` y
   `prediction_scores`, estructura del JSON de reglas, tabla
   `match_predictions`) y §6 (todos los criterios de puntuación:
   ganador, resultado exacto, cercanía de goles, prórroga, penaltis,
   equipo clasificado, multiplicadores por fase, predicciones iniciales,
   clasificados de grupo).
2. `context/plan/01-plan.md` — §7 hito 11 (funciones puras, orquestador,
   tests unitarios, `points_breakdown`).
3. `src/lib/scoring/recalculate.ts` — el **stub vacío** que ya existe y
   es llamado desde `confirmMatchResult`. El hito 11 lo rellena.
4. Bitácoras relevantes (patrones que reutilizarás):
   - `context/implementations/10-admin-results-entry-implementation.md`
     (CERRADO — cómo están `match_results` y `match_goals`; modelo de
     datos sin goles a 120').
   - `context/implementations/09-match-predictions-implementation.md`
     (CERRADO — modelo de `match_predictions`: sin resultado a 120',
     solo `predicts_extra_time`, `predicts_penalties`,
     `predicted_qualified_team_id`).

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

Hito 10 — Admin: introducción de resultados (CERRADO)
  Plan: `context/plan/10-admin-results-entry.md`
  Bitácora: `context/implementations/10-admin-results-entry-implementation.md`
  - Migración `20260517140000`: eliminado CHECK que ataba
    `went_extra_time` a la presencia de goles a 120' en
    `match_results`. Espejo de `20260517130000`. Columnas
    `home/away_goals_120` conservadas (nullable, siempre NULL).
  - `/admin/results` (listado por jornada): dropdown de ronda,
    badge de estado (Sin resultado / Borrador / Confirmado),
    marcador, columna "Pasa" solo en rondas de eliminatoria.
    Botón "🎲 Generar resultados aleatorios (esta jornada)" que
    confirma resultados random para todos los fixtures con equipos
    de la ronda seleccionada.
  - `/admin/results/[fixtureId]`: server component + `ResultForm.tsx`
    (`"use client"`). Modelo: 90' score + `went_penalties` +
    `qualified_team_id` (free pick cuando empate en knockout). La
    prórroga es derivada (knockout+empate90'⇒ET automático). Sin
    goles a 120'. Lista dinámica de goles (equipo, jugador nullable,
    minuto, periodo, own_goal, penalty_goal). Dos botones:
    "Guardar borrador" (`saveMatchResult`) y "Confirmar y recalcular"
    (`confirmMatchResult`). Vista read-only cuando confirmed (no
    redirect); botón "Editar resultado" → `?edit=1`.
  - `src/app/admin/results/schemas.ts`: `deriveResult(payload)` =
    única fuente de verdad para calcular columnas DB
    (`went_extra_time`, `winner_team_id`, `qualified_team_id`,
    `penalty_winner_team_id`); reusado por form action y generador
    random.
  - `src/app/admin/results/actions.ts`: `saveMatchResult` (draft),
    `confirmMatchResult` (confirmed + stub recálculo),
    `generateRandomResults` (por ronda, confirmed, sin goles).
  - `src/lib/scoring/recalculate.ts`: **stub vacío** — el hito 11
    lo rellena. Llamado por `confirmMatchResult` y
    `generateRandomResults`.
  - Commits: `b5b4fd8`, `1146245`, `d4b2171`.

# DECISIONES CERRADAS QUE AFECTAN AL HITO 11

Vinculantes. No las cuestiones sin un motivo muy fuerte.

- **El 120' score no existe** en ninguna tabla de predicciones ni de
  resultados. El scoring de eliminatorias solo puede comparar:
  - `match_predictions.predicts_extra_time` vs `match_results.went_extra_time`
  - `match_predictions.predicts_penalties` vs `match_results.went_penalties`
  - `match_predictions.predicted_qualified_team_id` vs
    `match_results.qualified_team_id`
  - El resultado a 90' (`home/away_goals_90`) existe en ambas tablas.
- **`src/lib/scoring/recalculate.ts` ya existe** como stub. La función
  `recalculateTournamentScores(tournamentId)` es el punto de entrada.
  El hito 11 implementa su cuerpo.
- **`scoring_rules` y `prediction_scores` ya existen** como tablas vacías.
  El hito 11 necesita: (1) una migración/seed con la fila de reglas activa
  para el torneo `wc_2022_test`, y (2) la lógica que escribe en
  `prediction_scores`.
- **Funciones puras primero.** El scoring debe ser testable de forma
  aislada antes de conectarse a la DB. Tests unitarios obligatorios.
- **Admin client para recalculate.** `recalculateTournamentScores` borra
  y reinserta `prediction_scores` (operación privilegiada) → usar
  `createAdminClient()` (service role). Las acciones de resultados usan
  el cliente de usuario (RLS `is_admin()`), pero el recálculo masivo
  bypasea RLS directamente.
- **Recálculo siempre completo.** Al confirmar un resultado, se borran
  TODAS las `prediction_scores` del torneo y se recalculan desde cero
  (pocos usuarios, pocos partidos; es barato y evita inconsistencias).
- **`initial_predictions` usa texto libre** (hito 08). Las columnas
  `top_scorer_text` y `best_player_text` son strings, no FKs a players.
  El scoring de pichichi/mejor jugador compara texto contra texto (o lo
  dejamos fuera del scope del hito 11 si es complejo; decidirlo en el
  plan).
- **Los valores numéricos del scoring son una decisión pendiente.** El
  PID §6 tiene ejemplos conceptuales. Propón unos valores razonables en
  el plan; el usuario los revisará.

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
  ...20260517130000_match_predictions_drop_120,
  ...20260517140000_match_results_drop_120.
  Tras cualquier migración nueva: `npm run types:gen` y luego
  `npx prettier --write src/lib/supabase/database.types.ts` (el
  fichero autogenerado no sale prettier-clean; formatéalo para que
  `format:check` quede verde).

Datos cargados:
  - **Prod**: torneo `wc_2022_test` (active), 32 teams, 48 fixtures
    de grupos. Predicciones de partido de los smokes del hito 09.
    Sin `scoring_rules`. Sin `prediction_scores`. Sin
    `match_results` (los resultados se introdujeron en local).
  - **Local**: lo mismo + 8 octavos `wc2022_r16_*` (solo local).
    Predicciones de partido de 3 usuarios de test. `match_results`
    y `match_goals` del hito 10 (introducidos manualmente y con el
    generador aleatorio). `FECHA_ACTUAL` probablemente en null.

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

# TAREA: HITO 11 — MOTOR DE PUNTUACIÓN

Objetivo: dado un resultado confirmado de un partido, calcular los
puntos de cada usuario según sus predicciones y las reglas activas del
torneo. Guardar el desglose en `prediction_scores`. Actualizar cada
vez que el admin confirma (o re-confirma) un resultado.

Pasos generales (sujetos a tu plan detallado en
`context/plan/11-scoring-engine.md`):

1. Leer PID §6 (todos los criterios de puntuación) y `01-plan.md`
   §7 hito 11. Inspeccionar `scoring_rules` y `prediction_scores`
   en local (psql o Studio).
2. Proponer en el plan: estructura del JSON de reglas (versión 1 con
   valores concretos), funciones puras con sus firmas, orquestador,
   si se scorean o no las predicciones iniciales en este hito, si
   se implementan tests con Vitest/Jest.
3. Migración con seed de `scoring_rules` (una fila activa para
   `wc_2022_test` con los valores acordados). Aplicar local + prod
   tras confirmación.
4. Funciones puras en `src/lib/scoring/`:
   - `scoreGroupMatch(prediction, result, rules)` → `{total, breakdown}`
   - `scoreKnockoutMatch(prediction, result, rules)` → `{total, breakdown}`
   - `scoreInitialPrediction(prediction, finalResult, rules)` (si entra
     en scope)
   - `scoreGroupQualificationPrediction(...)` (si entra en scope)
   - `applyStageMultiplier(points, stageCode, rules)` → number
5. Orquestador `recalculateTournamentScores(tournamentId)` en
   `src/lib/scoring/recalculate.ts` (ya existe como stub):
   1. Borrar `prediction_scores` del torneo.
   2. Leer predicciones + resultados confirmados + reglas activas.
   3. Calcular in-memory.
   4. Insertar en bulk.
6. Tests unitarios (mínimo: acierto exacto grupos, cerca por un gol,
   fallo, empate, knockout con ET, knockout con penaltis, equipo
   clasificado).
7. Verificar que al confirmar un resultado desde `/admin/results/[id]`
   el recálculo se dispara y `prediction_scores` se actualiza.
8. typecheck/lint/format/build verdes. Smoke local. Push master.
9. Bitácora en paralelo desde el paso 1.

# CÓMO TRABAJAS CONMIGO

- Primero escribes el plan detallado en
  `context/plan/11-scoring-engine.md`. Yo lo reviso y te digo
  "adelante" (o ajustes).
- Bitácora en paralelo en
  `context/implementations/11-scoring-engine-implementation.md`,
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

1. Lee "LEE ESTO ANTES DE NADA" (sobre todo PID §6, `01-plan.md`
   §7 hito 11, y las dos bitácoras cerradas).
2. Inspecciona el estado: estructura de `scoring_rules` y
   `prediction_scores` en psql; contenido de `match_predictions` y
   `match_results` disponibles en local para el smoke.
3. Escribe el plan detallado del hito 11 en
   `context/plan/11-scoring-engine.md`. No implementes todavía.
4. Pídeme aprobación.
5. Aprobado, ejecuta paso a paso siguiendo las convenciones de los
   hitos previos.
