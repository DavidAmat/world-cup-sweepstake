Hola. Continuamos un proyecto a mitad: una app web privada para gestionar
una porra del Mundial de fútbol 2026 entre 10 amigos. Llevamos 11 hitos
cerrados (02-11) + un hito intermedio 11b (migración a wc_2026 +
generador de cruces eliminatorios). Ahora toca el hito 12: leaderboards,
gráfico de evolución y desglose por partido para el usuario.

UI en español. Código, SQL y nombres de tabla en inglés. Comunícate
conmigo en español.

# QUÉ HITO ES Y DÓNDE ESTÁ DEFINIDO TÉCNICAMENTE

- **Hito 12 — Leaderboards, evolución y desglose por partido.**
- Definición técnica de alto nivel (fuente para el plan detallado):
  - `context/plan/01-plan.md` §7, sección "Hito 12 — Leaderboards y
    gráfico de evolución" (scope, esqueleto, acceptance).
  - `context/initial-setup/02-pid.md`: §4.2 (`prediction_scores`,
    `leaderboard_snapshots`).
  - **UX anotada en hito 11 §12** (`context/plan/11-scoring-engine.md`):
    - §12.1 guía pública con pestañas (probablemente ya cubierta por
      `documentation/user_guides/puntuacion.md`).
    - §12.2 **tooltip "ⓘ" por partido** en la vista de predicciones del
      usuario.
    - §12.3 gráfico de barras horizontales por partido en página
      personal.
- El **plan detallado lo escribes tú** al empezar, en
  `context/plan/12-leaderboards-and-visuals.md` (NO existe aún;
  crearlo es tu primer entregable). Yo lo reviso y te digo "adelante".
- La bitácora se va llenando **en paralelo** en
  `context/implementations/12-leaderboards-and-visuals-implementation.md`.

# LEE ESTO ANTES DE NADA

En este orden, hasta entender el estado actual:

1. `context/initial-setup/02-pid.md` — §4.2 (estructura de
   `prediction_scores` y `leaderboard_snapshots`).
2. `context/plan/01-plan.md` — §7 hito 12 (vistas SQL o queries con
   group by; Recharts vs alternativas; snapshots solo si hace falta).
3. `context/plan/11-scoring-engine.md` §12 — UX anotada que el usuario
   quiere ver en este hito (tooltip "ⓘ", gráfico personal). Está
   pendiente y es parte del alcance ahora.
4. `src/lib/scoring/recalculateCore.ts` — el motor del hito 11. Te
   interesa qué pone en `prediction_scores.points_breakdown`:
   - Match (grupos/knockout): `correct_outcome_90`, `exact_score_90`,
     `home_goals_distance`, `away_goals_distance`,
     `goal_difference_exact`, `correct_extra_time`,
     `correct_penalties`, `correct_qualified_team`.
   - Initial: `champion`, `runner_up`.
   - Group qualification: `team_correct`.
   - Meta (en todas): `_subtotal`, `_multiplier`, `_group` (solo gqp).
5. Bitácoras relevantes (patrones que reutilizarás):
   - `context/implementations/11-scoring-engine-implementation.md`
     (CERRADO — motor de puntuación y forma del breakdown).
   - `context/implementations/11b-wc2026-and-knockout-sampling-implementation.md`
     (CERRADO — wc_2026 sembrado, R32 incluida, botón de cruces).
   - `context/implementations/09-match-predictions-implementation.md`
     (CERRADO — modelo y UI de predicciones de partido, útil para el
     tooltip y la página `/predictions/matches`).
6. `documentation/user_guides/puntuacion.md` — guía de usuario del
   sistema de puntuación. Define máximos por partido (15 grupos / 66
   r32-r16-cuartos-tercero / 99 semis / 165 final), referencia para
   pintar barras y ejes Y.

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
  `data/seeds/wc_2026/`. Scripts `wc2026:upload` (tsx+Zod). 48 equipos
  en 12 grupos, 72 partidos de grupo + 32 eliminatorias con
  placeholders. (También quedan los seeds históricos
  `data/seeds/wc_2022/` y `scripts/wc2022/` como referencia.)

Hito 07 — Admin: fixtures (CERRADO)
  `/admin/fixtures` (listado/editar/crear/import JSON). Helpers
  reutilizables: `src/lib/dates/madridTime.ts`,
  `src/lib/tournament/getDefaultTournament.ts`,
  `src/lib/fixtures/{pythonFormat,catalogs}.ts` (catalog ahora con
  `round_of_32` y `r32`; multipliers alineados al JSON v1),
  `src/components/ui/Badge.tsx`. Gate de `/admin/*` en `src/proxy.ts`.

Hito 08 — Predicciones iniciales (CERRADO)
  Plan: `context/plan/08-initial-predictions.md`
  Bitácora: `context/implementations/08-initial-predictions-implementation.md`
  - `/predictions/initial` (form / solo lectura si lock — NO redirect)
    y `/predictions/initial/public` (card por usuario + dropdown por
    categoría, oculta hasta el lock).
  - `src/lib/predictions/initialLock.ts`: lock vía `rpc`.
  - Migración `20260515120000`: `initial_predictions` con texto libre
    para pichichi/MVP; funciones `initial_predictions_lock_at()` /
    `are_initial_predictions_locked()`.
  - Migración `20260516120000` — `FECHA_ACTUAL` / `app_now()`:
    `app_settings.fecha_actual` + función `public.app_now()`. La app
    sincroniza desde env `FECHA_ACTUAL` (`src/lib/dates/appNow.ts`).
    Banner "🧪 Fecha simulada". `make fecha FECHA=<v>`.
  - Clasificados de grupo: multi-choice (checkboxes), exactamente 2
    por grupo (`GROUP_QUALIFIERS=2`), sin orden.
  - Grupos: `GROUP_CODES = [A..L]` (12 grupos para 2026).

Hito 09 — Predicciones de partidos (CERRADO)
  - Migración `20260517120000`: `is_fixture_locked` con `app_now()`.
  - Migración `20260517130000`: eliminado CHECK que ataba ET a goles
    a 120'; sin resultado a 120' en predicciones.
  - `src/lib/predictions/matchLock.ts`: lock vía un único `rpc` +
    `isFixtureLocked` en JS.
  - `src/app/(app)/predictions/matches/schemas.ts`: Zod con
    `superRefine` (penaltis⇒prórroga; prórroga⇒empate 90'; knockout
    draw⇒prórroga obligatoria; el que pasa ∈{home,away}).
  - `actions.ts`: `saveAllMatchPredictions` (upsert masivo),
    `generateRandomMatchPredictions` (dado 40/30/30; draw en knockout
    → ET + 70% pen + 50/50 ganador).
  - `MatchesForm.tsx` con `derive(values, meta)` para lógica derivada,
    sticky bar + contador + botón global.
  - `/predictions/matches` server component con `RoundVM[]` (todas las
    jornadas apiladas, pills ancla `#r-{code}`).
  - `/predictions/matches/public`: card por fixture bloqueado.

Hito 10 — Admin: introducción de resultados (CERRADO)
  - Migración `20260517140000`: eliminado CHECK que ataba ET a goles
    a 120' en `match_results`.
  - `/admin/results` (listado por jornada): badge de estado, marcador,
    columna "Pasa" en knockouts. Botón "🎲 Generar resultados
    aleatorios (esta jornada)".
  - `/admin/results/[fixtureId]`: `ResultForm.tsx`. Modelo: 90' score
    + `went_penalties` + `qualified_team_id`. ET derivada
    (knockout+empate90'⇒ET). Lista dinámica de goles.
  - `actions.ts`: `saveMatchResult` (draft), `confirmMatchResult`
    (confirmed + recálculo), `generateRandomResults` (por ronda).

Hito 11 — Motor de puntuación (CERRADO)
  Plan: `context/plan/11-scoring-engine.md`
  Bitácora: `context/implementations/11-scoring-engine-implementation.md`
  - Migración `20260518120000`: rename CHECK
    `prediction_scores.prediction_type` (`'match'` → `'group_phase'`).
    El seed de `scoring_rules` ahora lo hace el uploader (no migración).
  - Guía pública: `documentation/user_guides/puntuacion.md`
    (criterios + multiplicadores + máximos).
  - `src/lib/scoring/`:
    - `types.ts`, `rules.ts` (`DEFAULT_SCORING_RULES_V1`).
    - `applyMultiplier.ts` (`applyStageMultiplier`).
    - `scoreMatch.ts` (`scoreGroupMatch`, `scoreKnockoutMatch`).
      **Si `exact_score_90` aplica, NO se cobran cercanías ni
      diff_exact** (D11-1). Acumulativo en lo demás.
    - `scoreInitial.ts` (`scoreInitialPrediction` — solo
      campeón/subcampeón; pichichi/MVP los asigna el admin a mano en
      hito 14).
    - `scoreGroup.ts` (`computeGroupTables`,
      `scoreGroupQualificationPrediction`). Tabla: pts → DG → GF →
      `team_code` asc.
    - `recalculateCore.ts`: orquestador puro (recibe supabase admin
      por parámetro). Borra y reinserta `prediction_scores` del
      torneo.
    - `recalculate.ts`: wrapper con `server-only`. Llamado desde
      `confirmMatchResult` y `generateRandomResults` y
      `generateKnockoutPairings`.
  - `points_breakdown` lleva siempre `_subtotal`, `_multiplier` y, en
    gqp, `_group`.
  - Smoke: `npm run scoring:smoke` ejecuta el core contra la DB local.

Hito 11b — Migración a wc_2026 + generador de cruces (CERRADO)
  Plan: `context/plan/11b-wc2026-and-knockout-sampling.md`
  Bitácora: `context/implementations/11b-wc2026-and-knockout-sampling-implementation.md`
  - Catálogo `src/lib/fixtures/catalogs.ts`: +R32 (`round_of_32`,
    `r32`). Multipliers alineados al JSON v1 (1, 2, 2, 2, 3, 2, 5).
  - `src/lib/fixtures/pythonFormat.ts`: +`dieciseisavos` en
    `FASE_VALUES` y mapas. Grupos `[A-L]`.
  - Seeds `data/seeds/wc_2026/{tournament,teams,fixtures}.json`:
    48 equipos en 12 grupos (A–L), 72 partidos de grupos (J1=29-may,
    J2=03-jun, J3=10-jun a 18:00 Madrid; pares canónicos FIFA),
    32 fixtures eliminatorias con placeholders `"TBD"` (R32=20-jun,
    R16=24-jun, QF=28-jun, SF=30-jun, 3rd+Final=01-jul).
  - `scripts/wc2026/upload.ts` (mirror de wc2022) +
    `scripts/wc2026/gen-fixtures.ts` (generador del JSON desde un
    manifest compacto, útil para ajustar fechas).
  - `scripts/wc2022/lib/upserts.ts`: +`upsertScoringRulesV1` (siembra
    `scoring_rules` v1 active del torneo) + soporte de placeholders
    (`equipo_1==="TBD"` → `home_placeholder="TBD"`,
    `home_team_id=null`).
  - `scripts/wc2022/lib/schemas.ts`: `TeamsSchema` ahora `.min(1)`
    (32 ↔ 48 equipos); `group_code` regex `[A-L]`.
  - Server action `generateKnockoutPairings` +
    botón **🎲 Generar cruces (esta ronda)** en `/admin/results`
    (solo rondas eliminatorias). Sample sin reposición de los 48
    equipos. Borra predicciones/resultados/goles previos de la
    ronda; dispara recálculo.
  - `src/app/(app)/predictions/initial/schemas.ts`: `GROUP_CODES`
    ahora 12 entradas (A–L).
  - `src/app/admin/fixtures/{schemas.ts, new/page.tsx}`: regex
    `[A-L]`.
  - `.env.local` + Vercel: `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2026`.
  - Prod: `wc_2022_test` borrado (CASCADE). `wc_2026` activo.

# DECISIONES CERRADAS QUE AFECTAN AL HITO 12

Vinculantes. No las cuestiones sin un motivo muy fuerte.

- **`prediction_scores` ya está poblada en local** tras los smokes del
  hito 11b. En prod sigue vacía hasta que algún usuario meta
  predicciones contra `wc_2026` y se confirme un resultado.
- **`points_breakdown` es la fuente para desgloses.** Claves:
  - `correct_outcome_90`, `exact_score_90`, `home_goals_distance`,
    `away_goals_distance`, `goal_difference_exact` (grupos y
    eliminatorias).
  - `correct_extra_time`, `correct_penalties`,
    `correct_qualified_team` (solo eliminatorias).
  - `champion`, `runner_up` (initial; `top_scorer` / `best_player`
    los inserta el admin en hito 14).
  - `team_correct` (group_qualification).
  - Meta (siempre): `_subtotal`, `_multiplier`. En gqp además
    `_group`.
- **Visualización VISIBLE PARA TODOS LOS USUARIOS** autenticados,
  no solo admin. Esto es **explícito del usuario**: cada uno ve sus
  propios puntos + el ranking general. RLS de `prediction_scores`
  ya lo permite (`SELECT` libre a `authenticated`).
- **Cliente de usuario, no admin client.** Las queries del hito 12
  son SELECT — usan el cliente de usuario (`createServerClient`) y
  respetan RLS. Reservar el admin client para escrituras
  privilegiadas (no aplica aquí).
- **No añadir dependencias sin OK explícito.** Recharts está
  sugerido en el plan §7 — pídeme aprobación antes de meterlo al
  `package.json`. Una alternativa con HTML+CSS (`div + width%` para
  barras horizontales; SVG inline para evolución) es preferible si
  cubre el caso.
- **Snapshots opcionales.** `leaderboard_snapshots` existe en BD
  pero vacía. Solo materializar si los cálculos on-the-fly son
  lentos (a 10 usuarios × ~104 partidos casi seguro NO hacen falta).
- **Tooltip "ⓘ" por partido entra en este hito.** Es la pieza más
  pequeña, da feedback inmediato a los usuarios y reusa el breakdown
  que ya está en BD. Es prioridad alta dentro del hito 12.
- **No tocar el motor del hito 11.** Si necesitas algo del breakdown
  que no esté, primero plantéamelo: puede salir más limpio derivarlo
  en JS desde el breakdown existente que añadir claves nuevas.

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
  SUPABASE_SECRET_KEY · **NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2026** ·
  FECHA_ACTUAL (testing).

Migraciones aplicadas (local Y prod):
  ...164810_predictions (match_predictions + RLS),
  ...20260515120000_initial_predictions_freetext_and_lock,
  ...20260516120000_app_now_override,
  ...20260517120000_is_fixture_locked_app_now,
  ...20260517130000_match_predictions_drop_120,
  ...20260517140000_match_results_drop_120,
  ...20260518120000_scoring_rules_seed_and_type_rename.
  Tras cualquier migración nueva: `npm run types:gen` y luego
  `npx prettier --write src/lib/supabase/database.types.ts`.

Datos cargados:
  - **Prod**: torneo `wc_2026` (active, is_test=true). 48 teams,
    7 stages, 9 rounds, 104 fixtures (72 grupos con equipos + 32
    eliminatoria con placeholders "TBD"). `scoring_rules` v1
    activa. `prediction_scores` vacía. Sin `match_results`.
    `wc_2022_test` ya NO existe.
  - **Local**: `wc_2026` con las mismas 104 fixtures. Tras los
    smokes del hito 11b: cruces R32 generados con equipos reales,
    resultados aleatorios confirmados, predicciones iniciales +
    de partido para 2 usuarios (David1 admin, David2 no admin),
    `prediction_scores` poblada por el motor. `FECHA_ACTUAL`
    probablemente en null. Resto de rondas (R16, QF, SF, 3rd, Final)
    aún con placeholders "TBD".

Generadores admin que ya existen (úsalos para smokes locales):
  - `/admin/results` → "🎲 Generar cruces (esta ronda)" (R32 onwards).
  - `/admin/results` → "🎲 Generar resultados aleatorios (esta jornada)".
  - `/predictions/matches` → "🎲 Generar predicciones aleatorias"
    (cualquier usuario autenticado).
  - `/predictions/initial` → equivalente para predicciones iniciales.

Gotchas Next 16 ya resueltos (replícalos, no los redescubras):
  - `redirect()` en server component streaming mis-resuelve paths.
    Gates en `proxy.ts`; estados read-only se renderizan, no se
    redirige.
  - `Date.now()`/`Math.random()` en server components →
    `react-hooks/purity`. Usa el lock vía `rpc` (app_now() de la DB).
  - `<html>` lleva `suppressHydrationWarning` (extensiones). No lo
    quites.
  - Migración local: `npx supabase migration up --local`. A prod:
    `echo y | npx supabase db push --linked`.
  - Commits: máximo 1 línea, Conventional Commits en inglés,
    `Co-Authored-By: Claude`. Push directo a master.

# COMANDOS HABITUALES

  npm run dev                 # Next en localhost:3000
  npm run db:status / db:start / db:stop
  npx supabase migration up --local      # aplica migraciones nuevas
  npm run types:gen           # regenera database.types.ts (tras migración)
  npx prettier --write src/lib/supabase/database.types.ts
  npm run typecheck && npm run lint && npm run format:check && npm run build
  make fecha FECHA=2026-06-12T09:00      # simular fecha + reiniciar dev
  make fecha FECHA=                      # volver a fecha real
  npm run wc2026:upload       # sube el seed local (idempotente)
  npm run scoring:smoke       # ejecuta recalculateCore contra DB local

A producción (pide confirmación antes):
  echo y | npx supabase db push --linked # migraciones (pide OK)
  git push origin master                 # Vercel autodeploya
  Para `wc2026:upload` a prod: env vars de prod inline +
  `--confirm-prod` (lo hace el usuario, no el agente).

# TAREA: HITO 12 — LEADERBOARDS Y DESGLOSE POR PARTIDO

Objetivo: que cualquier usuario autenticado vea:

1. Una **clasificación general** (todos los participantes con sus
   puntos totales).
2. **Desgloses** por jornada / fase / categoría.
3. Una **vista de evolución** por jornadas (gráfico de burbujas con
   iniciales según el plan §7, o alternativa más simple si el plan
   detallado lo justifica).
4. En la vista de sus predicciones, un **tooltip "ⓘ"** por partido
   con el breakdown completo (criterio · valor · puntos), tomado de
   `prediction_scores.points_breakdown`.
5. Una vista personal `/my-scores` (o equivalente) con un gráfico de
   barras horizontales por partido: longitud = `points_total /
   max_possible_partido`.

Decide en el plan si las 5 piezas entran en este hito o si algunas
quedan para 13. Mi recomendación: **1, 2, 4** mínimo este hito; **3 y 5
si el plan detallado se mantiene compacto**.

Pasos generales (sujetos a tu plan detallado en
`context/plan/12-leaderboards-and-visuals.md`):

1. Leer PID §4.2, `01-plan.md` §7 hito 12, y la sección §12 del plan
   del hito 11.
2. Inspeccionar el estado de `prediction_scores` en local (`select *
   limit 10`) para ver las claves reales del breakdown.
3. Proponer en el plan: rutas (`/clasificacion`,
   `/clasificacion/desglose`, `/clasificacion/evolucion`,
   `/my-scores` si entra); forma de computar acumulados (vista SQL vs
   `group by` en JS); librería de gráficos (recomiendo CSS+SVG salvo
   que justifiques Recharts); estructura del tooltip y dónde se
   monta (probablemente en `/predictions/matches` y `/my-scores`).
4. (Si decides ruta SQL) Migración con vista materializada o vista
   normal. Aplicar local + prod tras confirmación.
5. Server components para las páginas; islas client (`"use client"`)
   solo donde haya estado interactivo (popup del tooltip, selector
   de jornada con `useState`, gráfico interactivo).
6. UI: top destacado, último destacado en colores consistentes con
   los del hito 09 (sticky bar, badges).
7. Verificar contra los `prediction_scores` de local: cuadres a mano
   de top 3 por categoría.
8. typecheck/lint/format/build verdes. Smoke local. Push master.
9. Bitácora en paralelo desde el paso 1.

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
  dependencias** al `package.json`. NUNCA borrados por
  `tournament_id` en scripts de verificación.
- Si un comando bash necesita interacción humana (passwords, prompts
  Y/n, login), pásamelo y dime qué buscar.
- Si editas un fichero que yo (o un linter/prettier) modificó,
  vuelve a leerlo antes de tocarlo.
- Toda migración SQL: la propones, la reviso, la aplicas
  (migration up local → db:push prod tras OK), regeneras tipos y los
  formateas con prettier.
- Sin tests automatizados (decisión heredada del hito 11).
  Verificación = smoke + psql + cuadre manual.
- Tras editar `.env.local`: SIEMPRE verifica con `grep` que el cambio
  está en disco (lección del 11b — un Edit no persistió y descubrí
  la pérdida cuando el dev server seguía cargando el slug viejo).

# EMPIEZA AQUÍ

1. Lee "LEE ESTO ANTES DE NADA" (sobre todo `01-plan.md` §7 hito 12,
   §12 del plan del hito 11, y la bitácora del hito 11 y 11b para
   conocer las claves del breakdown y el estado de los datos).
2. Inspecciona el estado: `select prediction_type, count(*),
   sum(points_total), jsonb_pretty(points_breakdown) from
   prediction_scores limit 5` en psql; columnas, valores típicos.
3. Escribe el plan detallado del hito 12 en
   `context/plan/12-leaderboards-and-visuals.md`. No implementes
   todavía.
4. Pídeme aprobación.
5. Aprobado, ejecuta paso a paso siguiendo las convenciones de los
   hitos previos.
