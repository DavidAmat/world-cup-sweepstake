# Scoring Engine

Versioned, idempotent recalculation from predictions + confirmed results into `prediction_scores`, with per-criterion breakdowns.

## What it is

When the admin **confirms** a result (or other flows trigger a recalc), the engine:

1. Loads the active `scoring_rules` JSON for the tournament
2. Deletes all existing `prediction_scores` for that tournament
3. Recomputes every score from scratch (match, initial, group qualification)
4. Inserts new rows with `points_breakdown` and `scoring_rules_version`

Pure scoring functions live in `src/lib/scoring/*`; orchestration in `recalculateCore.ts`. Production entry point: `recalculateTournamentScores()` (service-role client).

The app runs **one tournament** (`wc_2026`) with **one fixed rules set** in practice. `/admin/reglas` supports versioning for flexibility, but new rule versions are not part of the product plan.

## Active rules (v1 defaults)

Authoritative numbers match `DEFAULT_SCORING_RULES_V1` and the Spanish user guide.

| Category | Points |
|----------|--------|
| Group match — correct outcome (90') | 5 |
| Group match — exact score (90') | 10 (absorbs distance + diff) |
| Per-team goal distance | 3 / 2 / 1 (exact / ±1 / ±2) |
| Goal difference exact | 3 |
| Knockout — prórroga (if it happened + predicted) | 5 |
| Knockout — penaltis (if they happened + predicted) | 5 |
| Knockout — correct qualified team | 8 |
| Stage multipliers | groups ×1; R32/R16/QF/third ×2; SF ×3; final ×5 |
| Champion / runner-up | 200 / 150 |
| Pichichi / mejor jugador | 100 / 100 (admin flags) |
| Group clasificado per correct team | 25 |

Prórroga and penaltis points apply only when the event **actually occurred** and the user **predicted** it — not for correctly predicting their absence.

## Prediction types stored

`prediction_scores.prediction_type`:

- `group_phase` — group-stage fixtures
- `knockout` — knockout fixtures
- `initial` — champion, runner-up, subjective awards
- `group_qualification` — clasificados (one row per user per group when scorable)

## Who advances (group qualification)

`computeAdvancingTeams` (`src/lib/scoring/scoreGroup.ts`) turns the per-group standings (`computeGroupTables`) into the set of teams that reach R32: the **top 2 of every completed group** plus the **`BEST_THIRDS_ADVANCE` (8) best third-placed teams**. Thirds are ranked globally by pts → goal difference → goals for → team code, and the ranking only resolves once **all 12 groups are complete** (you cannot rank the 12 thirds before then); until then only top-2 advance and third picks score 0. `scoreGroupQualificationPrediction` awards `group_qualification.team_correct` (25) per predicted team that is in that advancing set. The best-thirds gate is keyed on the tournament having an R32 round (`hasR32`). The admin can inspect the live standings + thirds ranking at **`/admin/standings`**.

## When recalculation runs

- Admin confirms a match result (`confirmMatchResult`)
- Admin random-results generator
- Player saves initial predictions
- Admin updates pichichi/mejor jugador evaluation
- Random match predictions / knockout pairings (after data wipe)

Draft results do **not** trigger recalc.

## Verification

```bash
npm run scoring:smoke              # local, default tournament
npm run scoring:smoke -- --slug wc_2026
```

Uses `recalculateTournamentScoresCore` directly with `SUPABASE_SECRET_KEY`.

## Where to look deeper

- Implementation: `documentation/services/web/scoring-engine.md`
- User-facing rules (Spanish): `documentation/user_guides/puntuacion.md`
- Results entry (confirm trigger): `context/web/results-entry.md`
- Initial / evaluaciones: `context/web/initial-predictions.md`
- Admin rules UI: `context/web/admin-reset-and-rules.md`
- Leaderboards (consumes scores): `context/web/leaderboards.md`
