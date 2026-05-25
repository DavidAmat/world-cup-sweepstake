# Hito 12 — Implementación

Bitácora paralela a `context/plan/12-leaderboards-and-visuals.md`.

---

## D12-0 · Arranque

- `prediction_scores` estaba vacía en local (la BD se debió
  reiniciar después de los smokes del hito 11b). Lanzado `npm run
  scoring:smoke` → 229 filas insertadas. Distribución:
  - group_phase: 144 (707 pts)
  - knockout: 64 (2009 pts)
  - group_qualification: 20 (105 pts)
  - initial: 1 (200 pts)
- 3 perfiles en local: David1 (admin), David2, David3 (sin scores).
- Plan detallado: `context/plan/12-leaderboards-and-visuals.md`.
- El usuario pidió implementar todo de un tirón y hacer commit+push
  al cierre. No esperamos aprobación de plan.

## D12-1 · Helpers en `src/lib/scoring/`

- `maxPoints.ts`: tabla `MAX_POINTS_BY_STAGE` (15/66/66/66/66/99/165)
  + helpers `maxPointsForStage()` y `maxSubtotalForCategory()`.
- `breakdownLabels.ts`: para cada clave del breakdown,
  `{label, group: "match"|"knockout_extra"|"initial"|"group_qual"|
  "meta"}`. Las claves "_subtotal"/"_multiplier"/"_group" son meta y
  no se pintan como filas.
- `leaderboard.ts`: queries reutilizables que devuelven view-models
  ya pivotados (rows por usuario, columnas por round / stage /
  categoría).

## D12-2 · Componentes UI

- `BreakdownTable.tsx` (server): tabla "criterio · valor · puntos"
  + pie con subtotal × multiplicador = total.
- `BreakdownPopover.tsx` (client): icono "ⓘ", popover controlado
  con click + Escape.
- `PointsBar.tsx` (server): div con `width: %` calculado.
- `EvolutionChart.tsx` (server): un `<svg>` con polilíneas por
  usuario + círculo con iniciales en el último punto.

## D12-3 · Páginas

- `/clasificacion` (server) con tabs como links a sub-rutas para
  evitar mezclar SSR + estado cliente.
- `/clasificacion/jornada/[roundCode]`, `/clasificacion/fase/
  [stageCode]`, `/clasificacion/categoria/[bucket]`,
  `/clasificacion/partido/[fixtureId]`, `/clasificacion/evolucion`.
- `/my-scores` con cards de categorías arriba + barras
  horizontales por partido + breakdown click-to-open.

## D12-4 · Integración

- `MatchesForm.tsx`: cuando `f.locked` y existe `prediction_scores`,
  renderiza la fila con un icono "ⓘ" que abre el breakdown.
- `Header.tsx`: enlace nuevo a Clasificación.
- `dashboard/page.tsx`: tarjeta nueva.

## D12-5 · Verificación

- `npm run typecheck` ✓ verde
- `npm run lint` ✓ verde
- `npm run format:check` → 12 ficheros nuevos sin formatear, corregido con
  `prettier --write` (deja todo en `format:check` verde).
- `npm run build` ✓ 23 rutas, incluyendo las 8 nuevas:
  `/clasificacion`, `/clasificacion/categoria`, `/clasificacion/evolucion`,
  `/clasificacion/fase`, `/clasificacion/jornada`,
  `/clasificacion/jornada/[roundCode]`, `/clasificacion/partido/[fixtureId]`,
  `/my-scores`.
- **Cuadre SQL (local, wc_2026, 229 filas en `prediction_scores`)**:
  - Totales generales: David1 1514, David2 1507, David3 0.
  - Validación de categorías: la suma de (match + knockout_extra + initial +
    group_qualification) × `_multiplier` cuadra fila a fila con
    `points_total` — **0 discrepancias** sobre 229 filas. La función JS
    `bucketFromBreakdown` y el motor del hito 11 dan exactamente lo mismo.

## D12-6 · Verificación que queda al usuario (UI)

El agente no testea la UI. El usuario debe abrir el dev server
(`npm run dev` en localhost:3000) y comprobar:

- `/clasificacion`: orden, top/bottom destacados, "tú" sobre la fila propia.
- `/clasificacion/jornada`: tabla de jornadas, click en una jornada →
  `/clasificacion/jornada/[code]` con la comparativa partido a partido.
- `/clasificacion/partido/[fixtureId]`: resultado oficial + cards de cada
  user con su predicción, puntos, barra de progreso y popover ⓘ.
- `/clasificacion/fase`, `/clasificacion/categoria`,
  `/clasificacion/evolucion`: cargan y el SVG de evolución se ve.
- `/my-scores`: 5 cards arriba (Total + 4 categorías), lista de partidos
  con barra horizontal y popover ⓘ.
- `/predictions/matches`: los partidos bloqueados con resultado muestran
  un botón "X pts ⓘ" junto al badge "Bloqueado".
- Header y `/dashboard`: links nuevos a Clasificación y Mi puntuación.
