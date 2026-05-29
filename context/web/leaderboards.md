# Leaderboards & Visuals

Read-only ranking and breakdown views over `prediction_scores`. All authenticated users can see every participant's totals once scores exist.

## What it is

After the scoring engine writes `prediction_scores`, the app surfaces them through:

1. **Clasificación** (`/clasificacion/*`) — comparative tables by jornada, fase, categoría, plus an evolution chart.
2. **Mis Predicciones** (`/my-scores`) — the signed-in user's personal breakdown with per-match bars and Real vs Tú score rows.
3. **Per-match detail** (`/clasificacion/partido/[fixtureId]`) — every participant's prediction, points, bar, and breakdown popover for one fixture.
4. **In-match ranking** — on `/predictions/matches`, locked fixtures expand to show a per-fixture ranking with bars and breakdown popovers (`LockedFixturePanel`).

Data is aggregated **on the fly in TypeScript** from `prediction_scores` rows (user Supabase client, RLS allows `SELECT` for all authenticated users). The `leaderboard_snapshots` table exists in the schema but is **not populated** — with ~10 users and ~104 fixtures, live aggregation is fast enough.

## Routes and navigation

| Route | Purpose |
|-------|---------|
| `/clasificacion` | Redirects to `/clasificacion/jornada` |
| `/clasificacion/jornada` | Default view: pivot table (users × jornadas) + pichichi / mejor jugador / clasificados columns + grand total |
| `/clasificacion/jornada/[roundCode]` | Per-fixture matrix for one jornada; fixture names link to partido detail |
| `/clasificacion/fase` | Points by tournament stage (group stage, R32, R16, …) |
| `/clasificacion/categoria` | Points by scoring category (match outcome, knockout extras, initial, group qualification) |
| `/clasificacion/evolucion` | Cumulative points chart across jornadas (SVG, server-rendered) |
| `/clasificacion/partido/[fixtureId]` | All users' predictions + scores for one match |
| `/my-scores` | Personal view; tab label **Mis Predicciones** in the Clasificación nav |

Shared tab bar (`ClasificacionTabs`): Por jornada · Por fase · Por categoría · Evolución · Mis Predicciones.

Header links: **Clasificación** → `/clasificacion/jornada`, **Mis Predicciones** → `/my-scores`. Home dashboard and landing page also link to these routes.

There is **no** standalone "general ranking" page anymore — the jornada table's **Total** column is the tournament-wide ranking.

## Data sources

All views read from:

- `prediction_scores` — `points_total`, `points_breakdown`, `prediction_type`, `fixture_id`
- `profiles` — every profile appears even with 0 points
- `fixtures`, `rounds`, `stages` — for jornada/fase pivots and ordering
- `match_results` (confirmed) — for Real vs Tú display and dynamic `maxPointsForFixture`
- `match_predictions` — for per-user prediction text on partido and my-scores pages

`points_total` is `numeric(8,2)` — Supabase returns it as a string; all loaders coerce with `Number()`.

## Category buckets

Four buckets drive `/clasificacion/categoria` and the category cards on `/my-scores`. Values come from `bucketFromBreakdown()` in `breakdownLabels.ts`, which sums breakdown keys and multiplies by `_multiplier`:

| Bucket | Breakdown keys |
|--------|----------------|
| `match_outcome` | `correct_outcome_90`, `exact_score_90`, goal distance, `goal_difference_exact` |
| `knockout_extra` | `correct_extra_time`, `correct_penalties`, `correct_qualified_team` |
| `initial` | `champion`, `runner_up`, `top_scorer`, `best_player` |
| `group_qualification` | `team_correct` |

The jornada table splits initial scores into visible columns (Pichichi, Mejor Jug., Clasificados) plus hidden champion/runner-up folded into the grand total.

## Max points for bars

`maxPointsForFixture(stage, result)` sets the denominator for `PointsBar`:

- **Group stage:** always 15
- **Knockout, no result yet:** optimistic ceiling (33 × stage multiplier) so the bar has a reference
- **Knockout, confirmed:** 23 / 28 / 33 subtotal × multiplier depending on whether ET and penaltis actually occurred

Static stage ceilings (`MAX_POINTS_BY_STAGE`: 15 / 66 / 99 / 165) remain for reference text; bars use the dynamic helper.

## Evolution chart

`buildEvolution()` accumulates match points jornada-by-jornada. Initial predictions and group-qualification scores are applied entirely on the **first jornada that has confirmed match scores**, so the chart starts at a realistic baseline rather than zero.

Rendered as inline SVG (`EvolutionChart`) — no chart library. One polyline per user; avatar or initials disc at the last data point.

## Breakdown UI

- **`BreakdownTable`** (server) — criterion rows from `BREAKDOWN_ENTRIES`, footer with subtotal × multiplier = total
- **`BreakdownPopover`** (client) — "N pts ⓘ" button; popover portals to `document.body` to avoid clipping; supports controlled mode for one-open-at-a-time in `LockedFixturePanel`
- **`PointsBar`** (server) — horizontal fill; colour bands at 0% / 35% / 75%

Breakdown popovers appear only when a `prediction_scores` row exists (i.e. after a confirmed result triggered scoring).

## Admin recalculate

Admins see **Calcular puntuación** on `/clasificacion/jornada`. Server action `recalculateClasificacion()` calls `recalculateTournamentScores()` and revalidates all clasificacion + my-scores paths. Normal flows (confirm result, save predictions, evaluaciones) already recalc automatically — this button is a manual escape hatch.

## RLS and visibility

- `prediction_scores`: `SELECT` for all `authenticated` users
- Match predictions of others: visible only when the fixture's jornada is locked (RLS via `is_fixture_locked`) — leaderboards show **scores**, not raw predictions, except on dedicated comparison pages after lock

## Verification

No automated UI tests. Cross-check totals with SQL:

```sql
select p.display_name, sum(s.points_total) as total
from prediction_scores s
join profiles p on p.user_id = s.user_id
join tournaments t on t.id = s.tournament_id
where t.slug = 'wc_2026'
group by p.display_name
order by total desc;
```

Compare against the **Total** column on `/clasificacion/jornada`. Run `npm run scoring:smoke` first if local scores are empty.

## Where to look deeper

- Implementation: `documentation/services/web/leaderboards.md`
- Scoring engine (writes `prediction_scores`): `context/web/scoring-engine.md`
- Match predictions (locked fixture ranking): `context/web/match-predictions.md`
- User-facing scoring rules (Spanish): `documentation/user_guides/puntuacion.md`
