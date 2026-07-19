> Context: [`context/web/leaderboards.md`](../../../context/web/leaderboards.md)

# Leaderboards & Visuals — implementation detail

Routes, aggregation helpers, scoring UI components, and SQL touched by clasificacion views.

## Module map

```
src/lib/scoring/
  leaderboard.ts        loadLeaderboardData, buildGeneralRanking, buildByRound/Stage/Category/Evolution
  maxPoints.ts          MAX_POINTS_BY_STAGE, maxPointsForStage, maxPointsForFixture
  breakdownLabels.ts    BREAKDOWN_ENTRIES, bucketFromBreakdown, CATEGORY_LABELS

src/components/scoring/
  BreakdownTable.tsx    Server: criterion table + subtotal × multiplier footer
  BreakdownPopover.tsx  Client: portal popover, controlled/uncontrolled open state
  PointsBar.tsx         Server: horizontal progress bar with tone bands
  EvolutionChart.tsx    Server: inline SVG cumulative chart + legend

src/app/(app)/clasificacion/
  page.tsx                          redirect → /clasificacion/jornada
  Tabs.tsx                          ClasificacionTabs (link-based nav)
  actions.ts                        recalculateClasificacion (admin)
  jornada/page.tsx                  main pivot table + admin recalc button
  jornada/JornadaTable.tsx          client SortableTable
  jornada/[roundCode]/page.tsx      fixture × user matrix
  jornada/[roundCode]/RoundDetailTable.tsx
  fase/page.tsx + FaseTable.tsx
  categoria/page.tsx + CategoriaTable.tsx
  evolucion/page.tsx
  partido/[fixtureId]/page.tsx

src/app/(app)/my-scores/page.tsx    personal breakdown + Real/Tú score rows

src/app/(app)/predictions/matches/
  LockedFixturePanel.tsx            per-fixture ranking, PointsBar, BreakdownPopover
```

## Authorization

All clasificacion and my-scores pages call `requireAuth()`. Data loads use the **server user client** (`createClient()` from `@/lib/supabase/server`), not the service-role client.

`recalculateClasificacion` in `actions.ts` calls `requireAdmin()` then `recalculateTournamentScores()` (service role inside scoring module).

## Core loader: `loadLeaderboardData(tournamentId)`

Parallel Supabase queries:

| Table | Fields |
|-------|--------|
| `profiles` | `user_id`, `display_name`, `initials`, `role` |
| `prediction_scores` | `user_id`, `fixture_id`, `prediction_type`, `points_total`, `points_breakdown` |
| `fixtures` | `id`, `round_id`, `stage_id` |
| `rounds` | `id`, `code`, `name`, `sort_order`, nested `stages.code` |
| `stages` | `code`, `name`, `sort_order` |

Builds lookup maps:

- `fixtureToRound` — fixture id → round id
- `fixtureToStage` — fixture id → stage code (via round's stage)

Coerces every `points_total` to `number`.

## Aggregation functions

### `buildGeneralRanking(data)`

Sums all `prediction_scores` per user; includes profiles with 0. Sorts desc by total, asc by `display_name`. Assigns tied positions; flags `isTop` / `isBottom` when multiple users exist.

**Not used by a dedicated page** — `/clasificacion` redirects to jornada. Function remains available for future use or scripts.

### `buildByRound(data)`

Filters scores to `group_phase` + `knockout` with a `fixture_id`. Only includes rounds that have at least one scored fixture. Returns:

- `rounds` — scored rounds only, ordered by `sort_order`
- `rows` — per user: `byRound: Map<roundCode, points>`, `total` (match points only)
- `totalsByRound` — column sums

### `buildByStage(data)`

Same as by-round but pivots on `fixtureToStage`. Stages with no scored fixtures are omitted.

### `buildByCategory(data)`

For every score row, calls `bucketFromBreakdown(points_breakdown)` and accumulates the four category buckets plus `total` (= sum of all `points_total`).

### `buildEvolution(data)`

1. Reuses `buildByRound` for the jornada list
2. Pre-loads `initial` + `group_qualification` totals per user into `baseExtras`
3. For each jornada in sort order, adds match points to a running cumulative map
4. Returns `EvolutionPoint[]` with `cumulativeByUser: Map<user_id, number>` per round

Initial/GQP points appear on the first evolution point (first scored jornada), not spread across jornadas.

## `maxPoints.ts`

```ts
MAX_POINTS_BY_STAGE = {
  group_stage: 15,
  round_of_32: 66, round_of_16: 66, quarter_final: 66, third_place: 66,
  semi_final: 99,
  final: 165,
}
```

`maxPointsForFixture(stage, result)`:

| Condition | Knockout subtotal before × mult |
|-----------|--------------------------------|
| `group_stage` | 15 (fixed) |
| No confirmed result | 33 (optimistic: ET + penaltis assumed) |
| Decided in 90′ | 23 |
| ET, no penaltis | 28 |
| ET + penaltis | 33 |

Stage multipliers (from rules v1, duplicated here): groups ×1; R32/R16/QF/third ×2; SF ×3; final ×5.

Also exports `MAX_INITIAL_*` and `MAX_GROUP_QUALIFICATION_SLOT` (25) for reference elsewhere.

## `breakdownLabels.ts`

- `BREAKDOWN_ENTRIES` — ordered list with Spanish labels and `group` tag
- `isMetaKey(k)` — keys starting with `_` (`_subtotal`, `_multiplier`, `_group`)
- `bucketFromBreakdown(breakdown)` — maps keys to four `CategoryBucket` totals, each × `_multiplier`
- `CATEGORY_LABELS` / `CATEGORY_DESCRIPTIONS` — Spanish copy for categoria page cards

When `exact_score_90` is present, the scoring engine omits distance/diff keys — category sums still match `points_total`.

## Page details

### `/clasificacion/jornada`

Server component. After `buildByRound`, enriches rows with extra columns from non-match scores:

| Column | Source |
|--------|--------|
| Per-jornada cells | `buildByRound` match totals |
| Campeón | `champion` from initial breakdown (200 if correct) |
| Subcampeón | `runner_up` from initial breakdown (150 if correct) |
| Pichichi | `initial` row → `top_scorer` breakdown key |
| Mejor Jug. | `initial` row → `best_player` |
| Último | `last_place` from initial breakdown (100 if admin marks correct in evaluaciones) |
| Clasificados | sum of `group_qualification` `points_total` |
| Total | matches + campeón + subcampeón + pichichi + mejor_jug + último + clasificados |

`JornadaTable` (client) uses `SortableTable`. Round column headers link to `/clasificacion/jornada/[roundCode]`. Footer row **Pts totales** sums columns.

Admin-only form posts to `recalculateClasificacion`. Success banner when `?ok=recalculated`.

Avatars via `avatarUrlMapFor(profiles)` from `@/lib/profiles/avatars`.

### `/clasificacion/jornada/[roundCode]`

Loads fixtures for the round (with team names), confirmed 90′ results, and match scores. Builds `pointsByUserFixture[user][fixture]`. Profiles sorted by round total desc.

`RoundDetailTable`: rows = users, columns = fixtures. Fixture header links to `/clasificacion/partido/[id]`.

### `/clasificacion/fase`

`buildByStage` → `FaseTable`. Same sortable table pattern as jornada without extra initial columns.

### `/clasificacion/categoria`

Four description cards from `CATEGORY_DESCRIPTIONS`, then `CategoriaTable` with category columns + total.

### `/clasificacion/evolucion`

`buildEvolution` → `EvolutionChart`. Passes profiles with `avatarUrlFor(display_name)`.

Chart constants: `WIDTH=720`, `HEIGHT=540`, y-axis clipped to ~first-round minimum (not forced to 0) for readable deltas. `ROUND_SHORT_LABEL` abbreviates jornada names on x-axis.

### `/clasificacion/partido/[fixtureId]`

Loads fixture (stage, round, teams, kickoff), confirmed result, all `match_predictions`, all `prediction_scores` for fixture, all profiles.

Sorts users by `points_total` desc. Each card: prediction text (including knockout extras), `BreakdownPopover` + `BreakdownTable`, `PointsBar` with `maxPointsForFixture(stage, confirmedResult)`.

Knockout detection: stage code in `{ round_of_32, round_of_16, quarter_final, semi_final, third_place, final }`.

Kickoff displayed with `formatMadridDateTime`.

### `/my-scores`

Loads current user's scores, all fixtures, confirmed results, user's match predictions.

Top section: grand total card + four category cards.

**Por partido** grid: one card per scored fixture. Each card has:

- Link to partido page (team names)
- `ScoreRow` grid — **Real** row (warning tone) and **Tú** row (info tone) with goal cells coloured by distance (exact = green, ±1–2 = orange)
- Knockout extras under each row when applicable
- `PointsBar` + numeric `points/max` + `BreakdownPopover`

Uses same `ClasificacionTabs` with `active="mis-predicciones"`.

## UI components

### `BreakdownTable`

Renders rows for every `BREAKDOWN_ENTRIES` key present in breakdown (numeric). Unknown numeric keys rendered with raw key name. Footer: Subtotal, optional Multiplicador (when ≠ 1), Total (= `pointsTotal` prop), optional Grupo line from `_group`.

### `BreakdownPopover`

Client component. Props: `pointsTotal`, optional `label`, `children`, optional controlled `isOpen` + `onToggle`.

- Toggle on button click; close on outside click or Escape
- Position via `getBoundingClientRect`; flips above when below viewport is cramped
- Renders through `createPortal(..., document.body)` — `position: fixed`, `z-50`, `w-96`

`LockedFixturePanel` uses controlled mode with `openPopoverId` so only one popover is open per fixture.

### `PointsBar`

`value / max` → percentage width. Tones: zinc (0%), warning (<35%), info (<75%), success (≥75%). `role="progressbar"` with aria values.

### `EvolutionChart`

Server SVG. One colour per user from fixed palette. Data points show cumulative value label above each dot. Last point: avatar image (clipPath circle) or initials disc.

## Integration: `/predictions/matches`

`LockedFixturePanel` (see `match-predictions.md` detail):

- Expandable ranking for locked fixtures (default expanded via bulk toggle)
- Loads all users' predictions, scores, results when jornada locked
- Without confirmed result: "0 pts", grey bar at 0/max, pseudo-random stable order via `pseudoHash(fixtureId + user_id)`
- With confirmed result: sorted by points; `PointsBar` + controlled `BreakdownPopover`

`page.tsx` passes `maxPoints: maxPointsForFixture(stageCode, result)` into each fixture VM.

## `leaderboard_snapshots`

Table created in `20260508164954_scoring.sql` with RLS (`SELECT` authenticated, admin write). **Never written by current code** — all leaderboards aggregate from `prediction_scores` directly. Table is cleared on admin reset (`/admin/reset`) but not repopulated on recalc.

## Revalidation paths

These flows call `revalidatePath` on clasificacion and/or my-scores:

| Trigger | Paths |
|---------|-------|
| `recalculateClasificacion` | `/clasificacion`, `/clasificacion/jornada`, `/fase`, `/categoria`, `/evolucion`, `/my-scores` |
| Save match predictions | `/clasificacion`, `/my-scores` |
| Save initial predictions | `/clasificacion`, `/my-scores` |
| Admin evaluaciones | `/clasificacion`, `/categoria`, `/jornada`, `/my-scores` |
| Admin reglas recalc | `/clasificacion` layout, `/my-scores` |
| Admin reset | `/clasificacion` layout, `/my-scores` |

## SQL touched (read-only in these views)

| Table | Usage |
|-------|-------|
| `prediction_scores` | Primary score source |
| `profiles` | Participant list |
| `fixtures` | Ordering, team names, stage/round joins |
| `rounds`, `stages` | Pivot columns, evolution x-axis |
| `match_results` | Confirmed 90′ scores, ET/pen flags, qualified team |
| `match_predictions` | Prediction display on partido + my-scores |
| `tournaments` | Resolved via `getDefaultTournament()` |

No writes from clasificacion pages except admin recalculate (via scoring engine on `prediction_scores`).

## Verification commands

```bash
npm run scoring:smoke              # populate prediction_scores locally
npm run typecheck && npm run lint && npm run build
```

SQL cross-check (local `wc_2026`):

```sql
-- Grand total per user (compare to jornada Total column)
select p.display_name, sum(s.points_total)::int as total
from prediction_scores s
join profiles p on p.user_id = s.user_id
join tournaments t on t.id = s.tournament_id
where t.slug = 'wc_2026'
group by p.display_name
order by total desc;

-- Category sanity: bucket sums should match points_total per row
-- (run after smoke; 0 discrepancies expected)
```

## Related docs

- Scoring engine: `documentation/services/web/scoring-engine.md`
- Match predictions / LockedFixturePanel: `documentation/services/web/match-predictions.md`
- Database tables: `documentation/services/database/tables.md` (`prediction_scores`, `leaderboard_snapshots`)
