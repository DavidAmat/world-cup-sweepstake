Hola. Continuamos un proyecto a mitad: una app web privada para gestionar
una porra del Mundial de fútbol 2026 entre 10 amigos. Llevamos 12 hitos
cerrados (02-12) + un hito intermedio 11b. El hito 13 (resultados
públicos + stats por selección) **se eliminó** al cerrar el hito 12. Toca
ahora abordar los **hitos 14 y 15 a la vez** (admin: reset/reglas + UI
español pulida).

UI en español. Código, SQL y nombres de tabla en inglés. Comunícate
conmigo en español.

# QUÉ HITOS SON Y DÓNDE ESTÁN DEFINIDOS

- **Hito 14 — Admin: reset y reglas.** `/admin/reset` (selector +
  checkboxes + modal "BORRAR") y `/admin/reglas` (versionado de
  `scoring_rules` por torneo, editor JSON, activar, recalcular).
  Definición de alto nivel: `context/plan/01-plan.md` §"Hito 14 —
  Admin: reset y reglas".
- **Hito 15 — Diseño UI español.** Paleta definitiva, tokens
  semánticos en Tailwind, header/footer consistentes, estados (empty
  / loading / error) en español, accesibilidad básica. Definición de
  alto nivel: `context/plan/01-plan.md` §"Hito 15 — Diseño UI
  español".
- Los **planes detallados los escribes tú** al empezar:
  - `context/plan/14-admin-reset-and-rules.md` (no existe aún).
  - `context/plan/15-ui-design-spanish.md` (no existe aún).
- Las bitácoras se llenan **en paralelo** en
  `context/implementations/14-admin-reset-and-rules-implementation.md`
  y `context/implementations/15-ui-design-spanish-implementation.md`.

# LEE ESTO ANTES DE NADA

En este orden, hasta entender el estado actual:

1. `context/plan/01-plan.md` — §7 hito 14 y hito 15 (scope original).
2. `context/implementations/12-leaderboards-and-visuals-implementation.md`
   — bitácora cerrada del hito 12. Te interesa especialmente:
   - **D12-10** (lock manual por ronda → migración
     `20260525120000`).
   - **D12-12** (motor de scoring: prórroga/penaltis solo cuentan si
     suceden de verdad; `maxPointsForFixture` en lugar del max
     fijo).
   - **D12-13** (popover en portal, modo controlado).
3. `documentation/user_guides/bloqueo_predicciones.md` —
   funcionamiento del lock manual por ronda.
4. `documentation/user_guides/puntuacion.md` — regla de puntuación
   actual (con la nueva regla de prórroga/penaltis).
5. `src/lib/scoring/rules.ts` y `recalculateCore.ts` — fuente de las
   reglas v1 y el orquestador del motor. El hito 14 va a permitir
   versionarlas; el motor ya carga la `scoring_rules` activa del
   torneo, así que añadir versiones es sobre todo UI + servidor.
6. `src/app/admin/results/page.tsx` y `actions.ts` — patrón actual
   de admin con server actions, badges, banners y revalidatePath.
   Es el patrón a replicar en `/admin/reset` y `/admin/reglas`.
7. `src/components/scoring/BreakdownPopover.tsx` — patrón de
   componente cliente coordinable; sirve de plantilla si necesitas
   modales en hito 14.
8. Componentes UI existentes que el hito 15 va a unificar/extender:
   - `src/components/ui/Badge.tsx` (`Badge`, `FixtureStatusBadge`).
   - `src/components/layout/Header.tsx` (nav principal).
   - `src/components/scoring/*` (BreakdownPopover, BreakdownTable,
     PointsBar, EvolutionChart).
   - `src/app/layout.tsx` (`<html suppressHydrationWarning>` —
     ¡NO QUITAR!).

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
  `is_fixture_locked(uuid)` (redefinido en hito 12 — ahora consulta
  `rounds.predictions_locked_at`), `set_updated_at()`. RLS local+prod.

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
  `src/lib/fixtures/{pythonFormat,catalogs}.ts`. Gate de `/admin/*`
  en `src/proxy.ts`.

Hito 08 — Predicciones iniciales (CERRADO)
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
    Banner "🧪 Fecha simulada". `make fecha FECHA=<v>` solo afecta
    al lock de iniciales (los partidos los bloquea ahora el admin
    manualmente, no la fecha — ver hito 12).
  - Clasificados de grupo: multi-choice (checkboxes), exactamente 2
    por grupo (`GROUP_QUALIFIERS=2`), sin orden.
  - Grupos: `GROUP_CODES = [A..L]` (12 grupos para 2026).

Hito 09 — Predicciones de partidos (CERRADO)
  - Migración `20260517130000`: eliminado CHECK que ataba ET a goles
    a 120'; sin resultado a 120' en predicciones.
  - `src/app/(app)/predictions/matches/schemas.ts`: Zod con
    `superRefine` (penaltis⇒prórroga; prórroga⇒empate 90'; knockout
    draw⇒prórroga obligatoria; el que pasa ∈{home,away}).
  - `actions.ts`: `saveAllMatchPredictions` (upsert masivo),
    `generateRandomMatchPredictions` (dado 40/30/30; draw en knockout
    → ET + 70% pen + 50/50 ganador).
  - `MatchesForm.tsx` con `derive(values, meta)` para lógica derivada,
    sticky bar + contador + botón global "Mostrar/Ocultar todas las
    predicciones" (añadido en hito 12).
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
    (knockout+empate90'⇒ET). Lista dinámica de goles (la app NO
    trackea goleadores por estadísticas, solo los guarda).
  - `actions.ts`: `saveMatchResult` (draft), `confirmMatchResult`
    (confirmed + recálculo), `generateRandomResults` (por ronda).

Hito 11 — Motor de puntuación (CERRADO)
  - Migración `20260518120000`: rename CHECK
    `prediction_scores.prediction_type` (`'match'` → `'group_phase'`).
    El seed de `scoring_rules` lo hace el uploader (no migración).
  - Guía pública: `documentation/user_guides/puntuacion.md`.
  - `src/lib/scoring/`:
    - `types.ts`, `rules.ts` (`DEFAULT_SCORING_RULES_V1`).
    - `applyMultiplier.ts` (`applyStageMultiplier`).
    - `scoreMatch.ts` (`scoreGroupMatch`, `scoreKnockoutMatch`).
      **Si `exact_score_90` aplica, NO se cobran cercanías ni
      diff_exact**. Acumulativo en lo demás. **ET/penaltis solo
      cuentan si suceden de verdad** (D12-12).
    - `scoreInitial.ts` (`scoreInitialPrediction` — solo
      campeón/subcampeón; pichichi/MVP los asigna el admin a mano).
    - `scoreGroup.ts` (`computeGroupTables`,
      `scoreGroupQualificationPrediction`). Tabla: pts → DG → GF →
      `team_code` asc.
    - `recalculateCore.ts`: orquestador puro (recibe supabase admin
      por parámetro). Borra y reinserta `prediction_scores` del
      torneo. **Lee la `scoring_rules` activa del torneo**.
    - `recalculate.ts`: wrapper con `server-only`. Llamado desde
      `confirmMatchResult`, `generateRandomResults` y
      `generateKnockoutPairings`.
  - `points_breakdown` lleva siempre `_subtotal`, `_multiplier` y, en
    gqp, `_group`.
  - Smoke: `npm run scoring:smoke` ejecuta el core contra la DB local.

Hito 11b — Migración a wc_2026 + generador de cruces (CERRADO)
  - Catálogo `src/lib/fixtures/catalogs.ts`: +R32 (`round_of_32`,
    `r32`). Multipliers alineados al JSON v1 (1, 2, 2, 2, 3, 2, 5).
  - Seeds `data/seeds/wc_2026/{tournament,teams,fixtures}.json`:
    48 equipos en 12 grupos (A–L), 72 partidos de grupos, 32 fixtures
    eliminatorias con placeholders `"TBD"`.
  - `scripts/wc2026/upload.ts`, `scripts/wc2026/gen-fixtures.ts`,
    `upsertScoringRulesV1` (siembra `scoring_rules` v1 active).
  - Server action `generateKnockoutPairings` +
    botón **🎲 Generar cruces (esta ronda)** en `/admin/results`.
  - `.env.local` + Vercel: `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2026`.
  - Prod: `wc_2022_test` borrado (CASCADE). `wc_2026` activo.

Hito 12 — Leaderboards, visuales y lock manual (CERRADO)
  Plan: `context/plan/12-leaderboards-and-visuals.md`
  Bitácora: `context/implementations/12-leaderboards-and-visuals-implementation.md`

  ### Vistas nuevas
  - `/clasificacion` — ranking general (top/bottom destacados,
    chip "tú").
  - `/clasificacion/jornada`, `.../jornada/[roundCode]`,
    `/clasificacion/fase`, `/clasificacion/categoria`,
    `/clasificacion/evolucion` — tablas pivotadas + gráfico SVG
    inline (sin Recharts).
  - `/clasificacion/partido/[fixtureId]` — comparativa de todos los
    participantes en un partido + breakdown.
  - `/my-scores` — vista personal con cards de categorías y barras
    horizontales por partido.

  ### Componentes nuevos
  - `src/lib/scoring/maxPoints.ts` con `maxPointsForFixture(stage,
    result)` — devuelve techo dinámico según ET/penaltis reales.
  - `src/lib/scoring/breakdownLabels.ts` — labels ES + buckets
    de categorías.
  - `src/lib/scoring/leaderboard.ts` — pivotes reutilizables.
  - `src/components/scoring/{BreakdownTable, BreakdownPopover,
    PointsBar, EvolutionChart}.tsx`. `BreakdownPopover` se renderiza
    con `createPortal` a `document.body` y soporta modo controlado
    (`isOpen` + `onToggle`).

  ### `/predictions/matches` enriquecida
  - `LockedFixturePanel` (cliente) con grid de 6 cols alineando
    "🏁 Real" + "Tú" + ranking expandido. Chevron por partido y
    botón global "Mostrar/Ocultar todas las predicciones". Default:
    expandido.
  - Cuando no hay resultado oficial todavía: fila Real vacía, Pts
    = "0 pts" en todas las filas, orden pseudo-aleatorio determinista
    por `hash(fixtureId + user_id)`.

  ### Cambio de paradigma: lock manual por ronda
  - Migración `20260525120000_manual_round_predictions_lock.sql`:
    `rounds.predictions_locked_at TIMESTAMPTZ NULL` +
    `rounds.predictions_locked_by UUID NULL`. Redefine
    `public.is_fixture_locked(uuid)` para que lea
    `rounds.predictions_locked_at IS NOT NULL` en lugar de
    `app_now() >= kickoff - 24h`. **La regla 24h desaparece.** RLS
    propaga sin cambios.
  - `/admin/results` gana sección "Bloqueo de predicciones por
    jornada" con tarjeta por ronda y botón Bloquear/Desbloquear.
    Server actions: `lockRoundPredictions`, `unlockRoundPredictions`.
  - `src/lib/predictions/matchLock.ts`: `MatchLockState` ahora
    incluye `lockedRoundIds: Set<string>`;
    `isFixtureLocked(roundId, lockedRoundIds)` reemplaza la API
    antigua. `getMatchLockState(tournamentId)` carga rondas.
  - Documentación nueva:
    `documentation/user_guides/bloqueo_predicciones.md`.

  ### Fix de scoring
  - `scoreKnockoutMatch`: ET/penaltis solo se conceden cuando
    suceden de verdad Y el usuario los predijo (`&&`, no `===`). Un
    partido decidido en 90' ya no regala 5+5 puntos.
  - `puntuacion.md` actualizado con la nueva regla y subtotal
    máximo 23/28/33 según tipo de partido.

  ### Estado de datos en local
  - 229 `prediction_scores` (group_phase 144, knockout 64,
    group_qualification 20, initial 1).
  - Lock manual en local: J1, J2, J3 y R32 bloqueadas; R16, QF, SF,
    third, final abiertas.
  - 3 profiles: David1 (admin), David2, David3.

  ### Pendiente prod
  - Migración `20260525120000` aplicada en **local** pero **NO en
    prod**. Hay que aplicarla con
    `echo y | npx supabase db push --linked` con OK explícito del
    usuario antes de tocar nada del hito 14/15 que asuma su
    presencia.

Hito 13 — ELIMINADO
  Las vistas `/resultados` y `/estadisticas/selecciones` se descartan:
  el desglose por partido ya está en
  `/clasificacion/partido/[fixtureId]` y la app no trackea goles por
  jugador ni estadísticas de selección.

# DECISIONES CERRADAS QUE AFECTAN A LOS HITOS 14 Y 15

Vinculantes. No las cuestiones sin un motivo muy fuerte.

- **`scoring_rules` ya existe y está activa por torneo.** El motor
  (`recalculateCore.ts`) lee la fila `active = true` del torneo
  actual. El hito 14 introduce versionado: nuevas filas con `active
  = false`, botón "activar" que pone `active = true` y desactiva las
  demás, botón "recalcular" que invoca `recalculateTournamentScores`.
- **Reset NO toca master data.** `/admin/reset` borra solo
  predicciones (initial/match/group_qualification), match_results,
  match_goals, prediction_scores y leaderboard_snapshots del torneo
  seleccionado. NO toca tournaments / teams / players / fixtures /
  stages / rounds / scoring_rules.
- **Confirmación literal "BORRAR".** Modal con input de texto que
  exige el literal exacto antes de habilitar el botón submit. Server
  action verifica de nuevo (defense in depth).
- **`/admin/reset` y `/admin/reglas` viven bajo el gate de
  `/admin/*`** (proxy.ts ya redirige al login / dashboard según
  rol). No hace falta `requireAdmin()` adicional dentro de la
  página, pero sí dentro de cada server action.
- **Sin nuevas dependencias para hito 15.** Tailwind v4 ya está. La
  paleta y los tokens los implementamos con `@theme` en
  `globals.css` (Tailwind v4 ya no usa `tailwind.config.ts`). Si
  necesitas añadir algo (p. ej. radix, headlessui), **pídelo
  primero**.
- **Iconos: lucide-react.** Ya está instalado. No añadir otro set
  (heroicons, phosphor, etc.) — usar lucide consistente.
- **UI en español, código en inglés.** Los textos visibles al
  usuario en español (revisa también los errores de Zod y mensajes
  de validación). Identificadores, server actions, columnas,
  variables, etc. en inglés.
- **No tocar el motor del hito 11.** Si necesitas que `/admin/reglas`
  hable con `recalculateTournamentScores`, llama el wrapper de
  `src/lib/scoring/recalculate.ts`, no rehagas la lógica.
- **No usar `connection()` de `next/server` salvo necesidad.** Se
  quitó en el hito 12 porque rompía el `react-hooks/purity` y no
  añadía nada útil. Las páginas admin pueden ser dinámicas sin él
  (Supabase con cookies ya forza dynamic).
- **`Date.now()` / `Math.random()` en server components →
  `react-hooks/purity`.** Si los necesitas, hazlo dentro de una
  server action (event handler), no en el render.

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
  SUPABASE_SECRET_KEY · NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2026 ·
  FECHA_ACTUAL (solo afecta al lock de predicciones iniciales).

Migraciones aplicadas:
  - **Local y prod**:
    ...164810_predictions (match_predictions + RLS),
    ...20260515120000_initial_predictions_freetext_and_lock,
    ...20260516120000_app_now_override,
    ...20260517120000_is_fixture_locked_app_now (redefinida por la
    siguiente; sigue existiendo como capa intermedia),
    ...20260517130000_match_predictions_drop_120,
    ...20260517140000_match_results_drop_120,
    ...20260518120000_scoring_rules_seed_and_type_rename.
  - **Solo local (pendiente prod)**:
    ...20260525120000_manual_round_predictions_lock.

  Tras cualquier migración nueva: `npm run types:gen` y luego
  `npx prettier --write src/lib/supabase/database.types.ts`.

Datos cargados:
  - **Prod**: torneo `wc_2026` (active, is_test=true). 48 teams,
    7 stages, 9 rounds, 104 fixtures (72 grupos con equipos + 32
    eliminatoria con placeholders "TBD"). `scoring_rules` v1
    activa. `prediction_scores` vacía. Sin `match_results`.
    `wc_2022_test` ya NO existe. Sin `predictions_locked_at` en
    rounds (la migración del hito 12 todavía no está aplicada).
  - **Local**: `wc_2026` con las mismas 104 fixtures. Smokes del
    hito 12: cruces R32 generados, resultados aleatorios
    confirmados, predicciones iniciales + de partido para 2
    usuarios (David1 admin, David2 no admin), `prediction_scores`
    poblada (229 filas) con la nueva regla de scoring. J1/J2/J3 y
    R32 bloqueadas; R16/QF/SF/third/final abiertas.
    `FECHA_ACTUAL` probablemente null.

Generadores admin que ya existen (úsalos para smokes locales):
  - `/admin/results` → "🎲 Generar cruces (esta ronda)" (R32 onwards).
  - `/admin/results` → "🎲 Generar resultados aleatorios (esta jornada)".
  - `/admin/results` → tarjetas "Bloquear / Desbloquear" por jornada.
  - `/predictions/matches` → "🎲 Generar predicciones aleatorias".
  - `/predictions/initial` → equivalente para predicciones iniciales.

Gotchas Next 16 ya resueltos (replícalos, no los redescubras):
  - `redirect()` en server component streaming mis-resuelve paths.
    Gates en `proxy.ts`; estados read-only se renderizan, no se
    redirige.
  - `Date.now()`/`Math.random()` en server components →
    `react-hooks/purity`. Usa el lock vía `rpc` (app_now() de la DB).
  - `<html>` lleva `suppressHydrationWarning` (extensiones). No lo
    quites.
  - `setState` dentro de `useEffect` → React 19 lo prohíbe
    (`react-hooks/set-state-in-effect`). En su lugar: setState en
    handlers (click, scroll, resize) o derivar el estado.
  - Componentes cliente con popover/modal: si los wrappers tienen
    `overflow-hidden`, usa `createPortal` (patrón en
    `BreakdownPopover.tsx`).
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

# TAREA: HITOS 14 + 15 EN PARALELO

Los dos hitos se atacan juntos porque comparten muchísima superficie:
ambos tocan páginas admin nuevas (hito 14) y el shell visual de toda
la app (hito 15). Hacer 14 sin pulir UI deja `/admin/reset` con
estética inconsistente; hacer 15 sin las pantallas admin nuevas te
fuerza a re-tocar después.

## Hito 14 — Admin: reset y reglas

Objetivo: que el admin pueda (a) resetear datos de un torneo con
confirmación literal "BORRAR" y (b) versionar / activar reglas de
puntuación.

Scope:

1. `/admin/reset`
   - Selector de torneo (UI: dropdown; por defecto el del slug por
     defecto).
   - Checkboxes de qué borrar:
     - Predicciones iniciales (`initial_predictions`).
     - Predicciones de partido (`match_predictions`).
     - Clasificados de grupo (`group_qualification_predictions`).
     - Resultados de partidos (`match_results` + `match_goals`).
     - Puntuaciones (`prediction_scores`).
     - Snapshots de leaderboard (`leaderboard_snapshots`).
   - Modal de confirmación: input de texto que exige el literal
     `BORRAR` antes de habilitar el submit.
   - Server action `resetTournamentData(formData)` que:
     - Llama a `requireAdmin()`.
     - Re-valida el literal "BORRAR" desde formData (defense in
       depth — no confiar solo en el cliente).
     - Ejecuta los deletes con `tournament_id` como filtro, en el
       orden correcto para no romper FKs (scores → predictions →
       results → goals; o usar `ON DELETE CASCADE` ya existente).
     - revalidatePath de las rutas afectadas
       (`/clasificacion/*`, `/my-scores`, `/predictions/*`,
       `/admin/results`, `/admin/reset`).
   - NUNCA tocar `tournaments`, `teams`, `players`, `fixtures`,
     `stages`, `rounds`, `scoring_rules`. Master data y reglas se
     gestionan en flujos separados.
   - Si quieres ser muy estricto: usar transacción RPC (SECURITY
     DEFINER) para que todo pase o nada — pero ojo, con RLS esto
     necesita el admin client (`src/lib/supabase/admin.ts`).
     Decisión a tomar en el plan.

2. `/admin/reglas`
   - Lista de versiones de `scoring_rules` del torneo seleccionado.
     Una fila por versión con: número de versión, badge "Activa" si
     `active = true`, fecha de creación, botones.
   - Botón "Duplicar y editar" → crea una nueva fila con `active =
     false`, copiando el JSON de la versión origen e incrementando
     `version`.
   - Editor JSON con validación Zod (mismo shape que
     `ScoringRulesV1`). Botón "Guardar borrador" que actualiza el
     JSON en su fila (sigue `active = false`).
   - Botón "Activar esta versión" → marca `active = true` en la
     elegida y `active = false` en todas las demás del mismo torneo.
     Server action transaccional.
   - Botón "Recalcular ahora" → llama a
     `recalculateTournamentScores(tournament.id)`. Banner de
     progreso opcional.
   - Tabla mínima útil en el editor JSON: si el shape se complica,
     un par de inputs numéricos por categoría también funcionan;
     decide en el plan.

3. Acceptance:
   - Un reset borra solo las tablas marcadas del torneo elegido y
     deja intactas las del otro torneo (verificable en local con
     `wc_2026` o creando un torneo de test efímero).
   - Crear una nueva versión de reglas que cambie `correct_outcome_90
     = 7` y activarla → recalcular → todos los `prediction_scores`
     suben coherentemente.

## Hito 15 — Diseño UI español

Objetivo: dejar la app con una sensación visual coherente, paleta
definitiva y copy en español revisado. No es un rediseño desde cero:
es **consolidar** lo que ya hay (badges, panels, popovers, layout
header) y pulir.

Scope:

1. **Paleta + tokens.** Tailwind v4 → variables CSS en `@theme` de
   `src/app/globals.css`:
   - `--color-primary`, `--color-accent`, `--color-success`,
     `--color-warning`, `--color-danger`, `--color-muted`.
   - Mapear a `bg-primary`, `text-primary-foreground`, etc.
   - Reemplazar los `bg-emerald-*`, `bg-amber-*`, `bg-rose-*`,
     `bg-sky-*` dispersos por estos tokens cuando aplique
     (semántica: success / warning / danger / info).
   - Si el usuario no ha entregado paleta, **propóntela tú** en el
     plan y pídele OK antes de implementar. Sugerencia base:
     primary oscuro azul/rojo + acentos neutros zinc.
2. **Tipografía e iconos.**
   - Mantener Geist (ya cargado en `src/app/layout.tsx`); revisar
     escalas tipográficas con clases utilities.
   - Iconos: estandarizar lucide-react donde haya emojis decorativos
     (`🏁`, `🔒`, `🎲`, `ⓘ`). Mantener emojis solo en banners de
     contexto fuerte (FECHA_ACTUAL).
3. **Layout.**
   - Header (`src/components/layout/Header.tsx`) ya existe — repasar
     enlaces, espaciados, contraste en dark mode, comportamiento
     responsive (menú hamburguesa si el viewport < md).
   - Footer mínimo: enlace a `/rules`, copyright, versión.
   - Decidir si la app tiene tema dark/light automático (ya está
     todo con `dark:` variants) o un toggle explícito.
4. **Estados consistentes.**
   - Empty states (sin partidos, sin puntuaciones) → componente
     reusable `EmptyState`.
   - Errores → componente reusable `ErrorBanner` (ya hay rojo en
     varias páginas).
   - Loading → casi nada porque todo es SSR, pero los formularios
     pueden mostrar `<button disabled>` en `useFormStatus`.
5. **Revisión de copys.**
   - Pasada general por todas las páginas. Detalles concretos:
     - `/predictions/matches`: el copy del header se reescribió en
       hito 12; revísalo.
     - `/rules` (la página, no las reglas de puntuación): repasar.
     - Mensajes de Zod (en `schemas.ts` de cada feature): asegurar
       que están en español y son útiles.
     - Confirmación literal "BORRAR" del hito 14: copy claro.
6. **Accesibilidad básica.**
   - Contraste suficiente en dark y light.
   - `aria-label` en botones-icono (lucide).
   - `aria-expanded` ya está en chevrons y popovers (revisar).
   - Foco visible (`focus-visible:ring-*`) en botones, inputs, links.

Acceptance:
- Las páginas comparten paleta y tipografía.
- Ningún copy en inglés visible al usuario final.
- El admin recién pulido (hito 14) ya nace con la paleta nueva.
- Lighthouse a11y razonable (>90 en home y dashboard).

# CÓMO TRABAJAS CONMIGO

- Primero escribes el plan detallado en
  `context/plan/14-admin-reset-and-rules.md` y
  `context/plan/15-ui-design-spanish.md`. Yo los reviso y te digo
  "adelante" (o ajustes).
- Bitácoras en paralelo en
  `context/implementations/14-admin-reset-and-rules-implementation.md`
  y `context/implementations/15-ui-design-spanish-implementation.md`,
  no al final.
- Commits: 1 por unidad coherente. **Mensaje de commit: máximo 1
  línea**, Conventional Commits en inglés, `Co-Authored-By: Claude`.
  Push directo a master tras cada commit (no preguntes cada vez).
- Pide confirmación antes de: acciones destructivas, `db:push` de
  una migración a prod, crear/borrar recursos Supabase/Vercel,
  borrar datos con predicciones asociadas, **añadir nuevas
  dependencias** al `package.json`. NUNCA borrados por
  `tournament_id` en scripts de verificación (ironía nota: el hito
  14 SÍ implementa exactamente eso, pero por UI con doble
  confirmación, no desde script suelto).
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
  está en disco.

# EMPIEZA AQUÍ

1. Lee "LEE ESTO ANTES DE NADA". Especialmente la bitácora del hito
   12 (D12-10 lock manual, D12-12 fix scoring) — son los cambios más
   recientes y afectan al hito 14 directamente.
2. Inspecciona el estado:
   - `select code, predictions_locked_at is not null as locked from
     rounds where tournament_id = (select id from tournaments where
     slug='wc_2026') order by sort_order;` para ver qué jornadas
     están bloqueadas en local.
   - `select version, active, rules from scoring_rules where
     tournament_id = (select id from tournaments where
     slug='wc_2026');` para conocer la fila activa que el hito 14
     va a versionar.
3. Pregunta al usuario:
   - Si quiere aplicar la migración `20260525120000` a prod antes de
     empezar el hito 14 (recomendado).
   - Paleta de colores definitiva para el hito 15 (o que apruebe la
     que propongas).
4. Escribe los planes detallados (14 y 15). No implementes todavía.
5. Pídele aprobación.
6. Aprobado, ejecuta paso a paso siguiendo las convenciones de los
   hitos previos. Puedes intercalar trabajo de 14 y 15 (lo más
   eficiente: ir terminando piezas del 14 con la paleta nueva ya
   aplicada).
