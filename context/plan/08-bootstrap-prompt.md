Hola. Continuamos un proyecto a mitad: una app web privada para gestionar
una porra del Mundial de fútbol 2026 entre 10 amigos. Llevamos 11 hitos
cerrados (02-11). Ahora toca el hito 12: leaderboards y gráfico de
evolución.

UI en español. Código, SQL y nombres de tabla en inglés. Comunícate
conmigo en español.

# QUÉ HITO ES Y DÓNDE ESTÁ DEFINIDO TÉCNICAMENTE

- **Hito 12 — Leaderboards y gráfico de evolución.**
- Definición técnica de alto nivel (fuente para el plan detallado):
  - `context/plan/01-plan.md` §7, sección "Hito 12 — Leaderboards y
    gráfico de evolución" (scope, esqueleto, acceptance).
  - `context/initial-setup/02-pid.md`: §4.2 (`prediction_scores`,
    `leaderboard_snapshots`).
- El **plan detallado lo escribes tú** al empezar, en
  `context/plan/12-leaderboards-and-visuals.md` (NO existe aún; crearlo
  es tu primer entregable). Yo lo reviso y te digo "adelante".
- La bitácora se va llenando **en paralelo** en
  `context/implementations/12-leaderboards-and-visuals-implementation.md`.

# LEE ESTO ANTES DE NADA

En este orden, hasta entender el estado actual:

1. `context/initial-setup/02-pid.md` — §4.2 (estructura de
   `prediction_scores` y `leaderboard_snapshots`).
2. `context/plan/01-plan.md` — §7 hito 12 (vistas SQL o queries con
   group by; Recharts vs alternativas; snapshots solo si hace falta).
3. `src/lib/scoring/recalculateCore.ts` — el motor del hito 11. Te
   interesa qué pone en `prediction_scores.points_breakdown` (incluye
   `_subtotal`, `_multiplier`, y para gqp `_group`).
4. Bitácoras relevantes (patrones que reutilizarás):
   - `context/implementations/11-scoring-engine-implementation.md`
     (CERRADO — cómo se rellena `prediction_scores`, qué claves trae
     el breakdown).
   - `context/implementations/10-admin-results-entry-implementation.md`
     (CERRADO — admin actions que disparan el recálculo).
5. `documentation/user_guides/puntuacion.md` — guía de usuario del
   sistema de puntuación. Te dirá los multiplicadores y máximos para
   pintar barras / ejes Y con escala razonable.

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
  - `src/lib/predictions/matchLock.ts`: `getMatchLockState()` =
    un único `rpc("app_now")` + `isFixtureLocked(kickoffIso, appNowIso)`
    en JS (= appNow ≥ kickoff − 24h).
  - `src/app/(app)/predictions/matches/schemas.ts`: Zod con
    `superRefine` que espeja los CHECK de `match_predictions` +
    invariantes (penaltis⇒prórroga; prórroga⇒empate 90'; knockout
    draw⇒prórroga obligatoria; el que pasa ∈{home,away}).
  - `actions.ts`: `saveAllMatchPredictions` (upsert masivo
    `onConflict fixture_id,user_id`). `generateRandomMatchPredictions`
    (dado 40%/30%/30%).
  - `MatchesForm.tsx` (`"use client"`): función `derive(values, meta)`
    centraliza la lógica derivada; sticky bar con contador + botón
    global.
  - `/predictions/matches/page.tsx`: server component; pills ancla
    `#r-{code}`, `scroll-mt-32`. Botón "🎲 Generar predicciones
    aleatorias" visible para TODOS los usuarios autenticados.
  - `/predictions/matches/public/page.tsx`: card por usuario por
    fixture bloqueado (RLS oculta lo no bloqueado).

Hito 10 — Admin: introducción de resultados (CERRADO)
  Plan: `context/plan/10-admin-results-entry.md`
  Bitácora: `context/implementations/10-admin-results-entry-implementation.md`
  - Migración `20260517140000`: eliminado CHECK que ataba
    `went_extra_time` a la presencia de goles a 120' en
    `match_results`.
  - `/admin/results` (listado por jornada): badge de estado
    (Sin resultado / Borrador / Confirmado), marcador, columna
    "Pasa" en knockouts. Botón "🎲 Generar resultados aleatorios
    (esta jornada)".
  - `/admin/results/[fixtureId]`: `ResultForm.tsx` (`"use client"`).
    Modelo: 90' score + `went_penalties` + `qualified_team_id`. La
    prórroga es derivada (knockout+empate90'⇒ET automático). Lista
    dinámica de goles. Dos botones: "Guardar borrador" y "Confirmar y
    recalcular".
  - `src/app/admin/results/schemas.ts`: `deriveResult(payload)` =
    única fuente de verdad para columnas DB derivadas.
  - `src/app/admin/results/actions.ts`: `saveMatchResult` (draft),
    `confirmMatchResult` (confirmed + recálculo),
    `generateRandomResults` (por ronda, confirmed).

Hito 11 — Motor de puntuación (CERRADO)
  Plan: `context/plan/11-scoring-engine.md`
  Bitácora: `context/implementations/11-scoring-engine-implementation.md`
  - Migración `20260518120000`: rename del CHECK de
    `prediction_scores.prediction_type` (`'match'` → `'group_phase'`)
    y seed de la primera fila de `scoring_rules` (version 1, active)
    para `wc_2022_test`.
  - Guía pública: `documentation/user_guides/puntuacion.md` (criterios
    + multiplicadores + máximos por categoría).
  - `src/lib/scoring/`:
    - `types.ts` (`ScoringRulesV1`, `MatchPredictionInput`,
      `MatchResultInput`, `ScoringOutput`).
    - `rules.ts` (`DEFAULT_SCORING_RULES_V1` — mirror del seed SQL,
      usado como fallback si la fila de scoring_rules faltase).
    - `applyMultiplier.ts` (`applyStageMultiplier`).
    - `scoreMatch.ts` (`scoreGroupMatch`, `scoreKnockoutMatch`).
      Regla clave: si `exact_score_90` aplica, NO se cobran
      `home/away_goals_distance` NI `goal_difference_exact` (D11-1).
    - `scoreInitial.ts` (`scoreInitialPrediction`): solo
      campeón/subcampeón; pichichi y MVP los asigna el admin a mano
      (hito 14).
    - `scoreGroup.ts` (`computeGroupTables`,
      `scoreGroupQualificationPrediction`). Orden de la tabla:
      pts → DG → GF → `team_code` ascendente.
    - `recalculateCore.ts`: orquestador puro (recibe el supabase
      admin client por parámetro). Borra y reinserta
      `prediction_scores` del torneo.
    - `recalculate.ts`: wrapper con `server-only` que crea el admin
      client y delega en core. Llamado desde `confirmMatchResult` y
      `generateRandomResults`.
  - `points_breakdown` lleva siempre `_subtotal` y `_multiplier` (y
    `_group` para `group_qualification`). Útil para tooltips del
    hito 12.
  - Smoke: `npm run scoring:smoke` ejecuta el core contra la DB local
    sin levantar Next. Imprime resumen por `prediction_type`.
    Verificado en local: 96 group_phase + 16 knockout + 14 gqp = 126
    filas, 6 casos representativos casados a mano contra la DB.
  - Sin tests automatizados (D11-4): verificación = cálculo a mano +
    smoke + psql.
  - Commits: `b72fb01`, `82cd506`, `1a67f6d`, `f7233cd`, `899260c`.

# DECISIONES CERRADAS QUE AFECTAN AL HITO 12

Vinculantes. No las cuestiones sin un motivo muy fuerte.

- **`prediction_scores` ya está poblada** (en local; en prod sigue
  vacía porque allí no hay `match_results` confirmados aún). El hito
  12 lee de esta tabla. Cada fila tiene `prediction_type` ∈
  `('group_phase', 'knockout', 'initial', 'group_qualification')`,
  `points_total numeric(8,2)`, `points_breakdown jsonb`.
- **`points_breakdown` es la fuente para desgloses.** Claves:
  - `correct_outcome_90`, `exact_score_90`, `home_goals_distance`,
    `away_goals_distance`, `goal_difference_exact` (grupos y
    eliminatorias).
  - `correct_extra_time`, `correct_penalties`,
    `correct_qualified_team` (solo eliminatorias).
  - `champion`, `runner_up` (initial; pichichi/MVP aparecerán como
    `top_scorer` / `best_player` cuando el hito 14 los inserte).
  - `team_correct` (group_qualification).
  - Meta: `_subtotal`, `_multiplier`, `_group` (solo en gqp).
- **El admin client del orquestador no es para el hito 12.** Las
  consultas del leaderboard son de lectura y deben respetar RLS
  (cliente de usuario). RLS actual sobre `prediction_scores`:
  `select` libre para autenticados; mutación solo admin.
- **Recharts ya está disponible solo si lo añades.** No está en
  `package.json` todavía. Plan §7 lo sugería; en el plan detallado
  decide si lo añades o lo haces con HTML+CSS (barras horizontales
  son triviales con `div + width%`; un scatter chart es más fácil
  con una lib).
- **Snapshots opcionales.** `leaderboard_snapshots` existe en BD pero
  está vacía. Solo materializar si los cálculos on-the-fly son lentos
  (a 10 usuarios × ~64 partidos, casi seguro no hacen falta).
- **Tooltip de desglose por partido (UX anotada en hito 11 §12.2)**
  es candidato natural para este hito o el 13. Decide en el plan si
  entra aquí.

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
  ...20260517140000_match_results_drop_120,
  ...20260518120000_scoring_rules_seed_and_type_rename.
  Tras cualquier migración nueva: `npm run types:gen` y luego
  `npx prettier --write src/lib/supabase/database.types.ts`. (Nota
  del hito 11: si la migración solo toca un CHECK textual, los
  tipos NO cambian; aun así corre el comando por consistencia.)

Datos cargados:
  - **Prod**: torneo `wc_2022_test` (active), 32 teams, 48 fixtures
    de grupos. Predicciones de partido de los smokes del hito 09.
    1 fila en `scoring_rules` (v1 active). `prediction_scores` vacía.
    Sin `match_results` (los resultados se introdujeron solo en local).
  - **Local**: lo mismo + 8 octavos `wc2022_r16_*` (solo local).
    Predicciones de partido de 2 usuarios de test (David1, David2).
    `match_results` y `match_goals` del hito 10 (introducidos
    manualmente y con el generador aleatorio). 126
    `prediction_scores` (96 group_phase + 16 knockout + 14
    group_qualification) tras el smoke del hito 11. `FECHA_ACTUAL`
    probablemente en null.

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
  npm run scoring:smoke       # ejecuta recalculateCore contra DB local

A producción (pide confirmación antes):
  echo y | npx supabase db push --linked # migraciones (pide OK)
  git push origin master                 # Vercel autodeploya

# TAREA: HITO 12 — LEADERBOARDS Y GRÁFICO DE EVOLUCIÓN

Objetivo: ofrecer la clasificación general + desgloses + visualización
de evolución. Aprovecha `prediction_scores` (rellenada por el hito 11).

Pasos generales (sujetos a tu plan detallado en
`context/plan/12-leaderboards-and-visuals.md`):

1. Leer PID §4.2 (estructura `prediction_scores` /
   `leaderboard_snapshots`), `01-plan.md` §7 hito 12, y la bitácora del
   hito 11 (sobre todo las claves de `points_breakdown`).
2. Proponer en el plan: rutas (`/clasificacion`,
   `/clasificacion/desglose`, `/clasificacion/evolucion`), forma de
   computar acumulados (vistas SQL vs queries con `group by` en JS),
   librería de gráficos (Recharts vs CSS puro), si entra el tooltip de
   desglose por partido y dónde, si entra `leaderboard_snapshots`.
3. Migración (opcional) si se decide vista SQL para desgloses o tabla
   materializada. Aplicar local + prod tras confirmación.
4. Server components para las páginas; cliente solo donde hay gráfico
   interactivo.
5. UI: top destacado, último destacado, badge de jornada en filtros,
   color consistente con la guía `puntuacion.md`.
6. Verificar contra los 126 `prediction_scores` de local: cuadres a
   mano de top 3 por categoría.
7. typecheck/lint/format/build verdes. Smoke local. Push master.
8. Bitácora en paralelo desde el paso 1.

# CÓMO TRABAJAS CONMIGO

- Primero escribes el plan detallado en
  `context/plan/12-leaderboards-and-visuals.md`. Yo lo reviso y te
  digo "adelante" (o ajustes).
- Bitácora en paralelo en
  `context/implementations/12-leaderboards-and-visuals-implementation.md`,
  no al final.
- Commits: 1 por unidad coherente. **Mensaje de commit: máximo 1
  línea**, Conventional Commits en inglés, `Co-Authored-By: Claude`.
  Push directo a master tras cada commit (no preguntes cada vez).
- Pide confirmación antes de: acciones destructivas, `db:push` de
  una migración a prod, crear/borrar recursos Supabase/Vercel,
  borrar datos con predicciones asociadas, **añadir nuevas
  dependencias** (Recharts/D3/etc) al `package.json`. NUNCA borrados
  por `tournament_id` en scripts de verificación.
- Si un comando bash necesita interacción humana (passwords, prompts
  Y/n, login), pásamelo y dime qué buscar.
- Si editas un fichero que yo (o un linter/prettier) modificó,
  vuelve a leerlo antes de tocarlo.
- Toda migración SQL: la propones, la reviso, la aplicas
  (migration up local → db:push prod tras OK), regeneras tipos y los
  formateas con prettier.
- Sin tests automatizados (decisión heredada del hito 11).
  Verificación = smoke + psql + cuadre manual.

# EMPIEZA AQUÍ

1. Lee "LEE ESTO ANTES DE NADA" (sobre todo `01-plan.md` §7 hito 12 y
   la bitácora del hito 11 para conocer las claves del breakdown).
2. Inspecciona el estado: `select * from prediction_scores limit 10`
   en psql; columnas, valores típicos de `points_breakdown`.
3. Escribe el plan detallado del hito 12 en
   `context/plan/12-leaderboards-and-visuals.md`. No implementes
   todavía.
4. Pídeme aprobación.
5. Aprobado, ejecuta paso a paso siguiendo las convenciones de los
   hitos previos.
