# Hito 12 — Implementación

Bitácora paralela a `12-leaderboards-and-visuals-plan.md`.

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
- Plan detallado: `12-leaderboards-and-visuals-plan.md`.
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

## D12-6 · Verificación inicial (UI)

Tras los commits 1 a 4 (`4b746da` …), el usuario validó las vistas
nuevas en local y pidió varias iteraciones recogidas debajo (D12-7 a
D12-12). Esa fue la "verificación inicial" — ningún regression de
build/lint/typecheck, todas las páginas cargan, RLS respeta la
visibilidad de predicciones ajenas.

## D12-7 · `LockedFixturePanel`: alineación vertical + chevron de ranking

Commit `5ddd5c1`. En `/predictions/matches`, cada fixture **bloqueado**
abandona la `ReadOnly` simple anterior y pasa a `LockedFixturePanel`:

- Grid de 6 columnas que alinea verticalmente la fila "🏁 Real" + la
  fila "Tú" + cualquier ranking expandido. Los goles del local y del
  visitante quedan en las mismas columnas en todas las filas.
- `page.tsx`: ahora carga `match_predictions`, `prediction_scores` y
  `match_results` de **todos** los usuarios y los pivota en JS en
  `predsByFixtureUser` / `scoresByFixtureUser` / `resultByFixture`.
- Chevron "Ver/Ocultar predicciones de otros" para revelar las
  predicciones de los demás participantes (RLS solo las devuelve si
  la ronda está bloqueada, así que no hay fuga).

## D12-8 · Ranking del partido con barras horizontales

Commit `f22fdbe`. El chevron pasa de "Ver predicciones de otros" a
"Ver ranking de este partido" e incluye a **todos** los participantes
(yo incluido, marcado "tú"):

- Ordenado por `points_total` descendente.
- Cada fila lleva su posición (#1, #2 …) en círculo gris.
- Bajo cada fila, `PointsBar` horizontal con `value / maxPoints`. Los
  colores van de zinc (0%) → amber (<35%) → sky (<75%) → emerald
  (≥75%).
- `FixtureVM` gana `maxPoints: number`; `page.tsx` lo calcula con
  `maxPointsForStage(stageCode)` (antes de D12-11).

## D12-9 · Botón global "Mostrar/Ocultar todas las predicciones"

Commit `bbe256c`. Sticky bar de `/predictions/matches` gana un botón
que coordina todos los `LockedFixturePanel` a la vez:

- `MatchesForm` mantiene `bulkSignal: { open: boolean; n: number }`.
  Cada clic bumpea `n`, así panels que el usuario hubiera abierto o
  cerrado a mano se re-sincronizan.
- Cada panel deriva su `expanded` así:
  `expanded = override && override.n === bulkSignal.n ? override.open
  : bulkSignal.open`. Sin `useEffect` con setState (React 19 lo
  prohíbe — regla `react-hooks/set-state-in-effect`).

## D12-10 · Lock manual por ronda (sustituye la regla 24h)

Commit `027ec65`. Cambio de paradigma: el admin decide manualmente
cuándo bloquear cada jornada — la regla automática "now ≥ kickoff −
24h" desaparece.

- Migración `20260525120000_manual_round_predictions_lock.sql`:
  - `rounds.predictions_locked_at TIMESTAMPTZ NULL`
  - `rounds.predictions_locked_by UUID NULL` → `profiles(user_id)`
  - **Redefine `public.is_fixture_locked(uuid)`** para que mire la
    ronda del fixture en lugar de `kickoff_at − 24h`. Como las
    policies RLS de `match_predictions` ya llamaban a esa función, el
    cambio propaga sin tocar policies.
- `src/lib/predictions/matchLock.ts` refactorizado:
  `MatchLockState` ahora incluye `lockedRoundIds: Set<string>`;
  `isFixtureLocked(roundId, lockedRoundIds)` reemplaza la versión
  basada en kickoff. `getMatchLockState(tournamentId)` carga rondas.
- `/admin/results` gana una sección **"Bloqueo de predicciones por
  jornada"** con una tarjeta por ronda (🟢 Abierta / 🔒 Bloqueada) y
  botón "Bloquear" / "Desbloquear". Server actions:
  `lockRoundPredictions(roundCode)` / `unlockRoundPredictions`.
- `/admin/fixtures/[id]/page.tsx` ajustado: quitada la
  `LOCK_WINDOW_MS = 24h` y el `connection()`; ahora el banner avisa
  si la ronda del fixture está bloqueada.
- `documentation/user_guides/bloqueo_predicciones.md` nuevo, explica
  el modelo entero (RLS, server actions, impacto en cada página).
- `Makefile`: comentario actualizado — `FECHA_ACTUAL` ya no afecta a
  los partidos, sigue gobernando el lock de las predicciones
  iniciales. La utilidad `make fecha` se mantiene.

## D12-11 · Default expandido + graceful sin resultado

Commit `285446e`. Tras el feedback del usuario:

- `bulkSignal` arranca con `{ open: true, n: 0 }` → todos los
  rankings se ven **expandidos** por defecto al cargar
  `/predictions/matches`.
- Cuando una jornada está bloqueada pero el admin aún no ha
  confirmado resultado:
  - Fila "🏁 Real" → "Aún sin resultado oficial confirmado."
  - Columna Pts de cada participante → "0 pts" (sin popover).
  - Barra a 0/max en gris.
  - Orden del ranking → pseudo-aleatorio determinista usando
    `pseudoHash(fixtureId + user_id)`. Cada fixture muestra un
    orden distinto, pero estable entre renders (no reshuffle al
    recargar).
- Banner FECHA_ACTUAL pierde el texto "El bloqueo de cada partido se
  evalúa contra esta fecha" (ya no aplica).

## D12-12 · Fix scoring: prórroga/penaltis solo cuando ocurren

Commit `b728306`. Bug real, no UX: el motor daba 5 + 5 puntos
"gratis" al usuario que predijo "no prórroga, no penaltis" en
partidos decididos en 90'.

- `scoreKnockoutMatch` cambia de `===` a `&&`:
  ```ts
  if (r.went_extra_time && p.predicts_extra_time) // antes: ===
  if (r.went_penalties && p.predicts_penalties)
  ```
  Los puntos solo se conceden cuando el evento ocurre realmente Y el
  usuario lo marcó.
- `maxPoints.ts`: nuevo `maxPointsForFixture(stage, result)` que
  devuelve el techo real del partido:
  - Sin resultado → 33 × mult (mejor caso, para que la barra tenga
    referencia).
  - Decidido en 90' → 23 × mult.
  - Prórroga sin penaltis → 28 × mult.
  - Prórroga + penaltis → 33 × mult.
  Reusado en `/predictions/matches`, `/my-scores`,
  `/clasificacion/partido/[fixtureId]`.
- `documentation/user_guides/puntuacion.md`: regla actualizada,
  ejemplos A/B/C reescritos con sus subtotales reales (23/28/33),
  tabla de máximos por tipo de partido + máximo absoluto por ronda
  (con penaltis asumidos).
- Re-corrido `npm run scoring:smoke` → 229 filas. Knockout sum bajó
  de 2009 a 1299 pts (los 5+5 gratis eliminados).
- Verificación SQL: 0 filas con `correct_extra_time` en partidos
  donde `went_extra_time = false`; 0 filas con `correct_penalties`
  donde `went_penalties = false`.

## D12-13 · Popover en portal + only-one-open por partido

Commit `d9f8993`. Tras feedback del usuario sobre clipping:

- `BreakdownPopover.tsx` ahora renderiza con `createPortal` a
  `document.body` con `position: fixed`. Ningún `overflow-hidden`
  ni `z-index` de ancestros lo puede recortar. La posición se
  calcula desde el `getBoundingClientRect()` del botón al hacer
  click (no en `useEffect` para satisfacer la regla
  `react-hooks/set-state-in-effect`), y se reposiciona en scroll y
  resize.
- Tamaño y legibilidad: ancho `w-72` → `w-96`; padding `p-3` →
  `p-4`; shadow `lg` → `2xl`; rounded `md` → `lg`; tabla con header
  `uppercase tracking-wide`, `py-1` → `py-1.5`.
- Modo controlado opcional: `BreakdownPopover` ahora acepta
  `isOpen` + `onToggle`. `LockedFixturePanel` mantiene
  `openPopoverId: string | null` y propaga a cada `PointsCell` con
  un id único (`"me-fixed"` para la fila fija "Tú",
  `entry.user_id` para cada fila del ranking). Resultado: solo un
  popover abierto a la vez por partido — al abrir uno, el anterior
  se cierra.
- Quitado `overflow-hidden` del `LockedFixturePanel` (ya no era
  necesario con el portal).

## D12-14 · Estado final

- **Build/lint/typecheck/format**: todos verdes.
- **Commits**: 4b746da, 5ddd5c1, f22fdbe, bbe256c, 027ec65, 285446e,
  b728306, d9f8993.
- **Migración nueva**: `20260525120000_manual_round_predictions_lock`
  aplicada en **local**. **Pendiente prod** — el usuario tiene que
  dar OK explícito para `echo y | npx supabase db push --linked`.
- **Estado BD local** (`wc_2026`):
  - 9 rondas, lock manual: group_md1/2/3 + r32 bloqueadas; r16, qf,
    sf, third, final abiertas.
  - 229 filas en `prediction_scores` tras smoke re-corrido con la
    nueva regla de scoring.
  - 3 profiles: David1 (admin), David2, David3 sin scores.
- **Documentación**:
  - `documentation/user_guides/puntuacion.md` actualizada (regla
    nueva de prórroga/penaltis).
  - `documentation/user_guides/bloqueo_predicciones.md` nueva.
- **Out of scope cumplido**: el hito 13 ("Resultados públicos y
  stats por selección") se elimina del plan maestro — los datos de
  resultados ya están en `/clasificacion/partido/[fixtureId]` y la
  app no trackea goles por jugador ni estadísticas de selección.
