> Context: [`context/web/scoring-engine.md`](../../../context/web/scoring-engine.md)

# Scoring Engine — implementation detail

Pure scorers, orchestrator, rules JSON, breakdown keys, and recalculation triggers.

## Module map

```
src/lib/scoring/
  types.ts              ScoringRulesV1, inputs/outputs, StageCode
  rules.ts              DEFAULT_SCORING_RULES_V1 (code fallback)
  scoreMatch.ts         scoreGroupMatch, scoreKnockoutMatch
  scoreInitial.ts       scoreInitialPrediction
  scoreGroup.ts         computeGroupTables, computeAdvancingTeams, scoreGroupQualificationPrediction, BEST_THIRDS_ADVANCE
  applyMultiplier.ts    applyStageMultiplier
  recalculateCore.ts    recalculateTournamentScoresCore (orchestrator)
  recalculate.ts        recalculateTournamentScores (server-only wrapper)
  maxPoints.ts          UI ceilings for bars and badges
  breakdownLabels.ts    Spanish labels for UI breakdown tables
  leaderboard.ts          aggregation helpers (leaderboards)
scripts/scoring/
  smoke-recalc.ts       npm run scoring:smoke
```

## Rules source

Active row: `scoring_rules` where `tournament_id` and `active = true` (partial unique index: one active per tournament).

JSON shape `ScoringRulesV1` — see `types.ts`. Seeded on upload via `scripts/wc2026/upload.ts` (`upsertScoringRulesV1`). Fallback if missing: `DEFAULT_SCORING_RULES_V1` in `rules.ts`.

Migration `20260528130000` bumped `group_qualification.team_correct` from 5 → **25** in active DB rows.

Admin editing: `/admin/reglas` — duplicate draft, edit numbers, activate, recalculate. See `context/web/admin-reset-and-rules.md`. Product scope is a single fixed set; versioning is infrastructure only.

## Orchestrator (`recalculateTournamentScoresCore`)

```text
1. Load active scoring_rules (version + rules JSON)
2. DELETE prediction_scores WHERE tournament_id = ?
3. Load stages, rounds, teams, fixtures, confirmed match_results
4. Build group tables from confirmed group-stage results (6 matches per group)
5. Derive champion/runner-up from final fixture qualified_team_id (if confirmed)
6. For each match_prediction + confirmed result → scoreGroupMatch | scoreKnockoutMatch
7. For each initial_predictions row → scoreInitialPrediction
8. For each user's group qualification picks → scoreGroupQualificationPrediction
9. INSERT all prediction_scores rows (batch)
```

Returns `{ inserted: number }`.

Breakdown JSON includes criterion keys plus meta: `_subtotal`, `_multiplier`, and for group qual `_group`.

Uses **admin/service client** — bypasses RLS for full-table delete/insert.

## Match scoring (`scoreMatch.ts`)

Shared base `scoreMatchCommon`:

1. **correct_outcome_90** — same sign of goal difference at 90'
2. **exact_score_90** — if exact, return (no distance/diff keys)
3. Else **home_goals_distance** / **away_goals_distance** — keys `"0"|"1"|"2"` by absolute error; ≥3 → 0
4. **goal_difference_exact** — if predicted diff equals real diff

Knockout adds (`scoreKnockoutMatch`):

- **correct_extra_time** — `r.went_extra_time && p.predicts_extra_time`
- **correct_penalties** — `r.went_penalties && p.predicts_penalties`
- **correct_qualified_team** — IDs match

Subtotal summed; **total** = `applyStageMultiplier(subtotal, stageCode, rules)`.

## Initial scoring (`scoreInitial.ts`)

- **champion** / **runner_up** — when final is confirmed and IDs match derived outcome
- **top_scorer** / **best_player** — only when `top_scorer_correct === true` / `best_player_correct === true` (set in `/admin/evaluaciones`)

Multiplier always 1.

## Group qualification (`scoreGroup.ts`)

`computeGroupTables` — standard 3-1-0 table, sort by pts → GD → GF → code (`compareStandings`). `complete` when fixture count ≥ expected (6 for WC group stage).

`computeAdvancingTeams(tables, expectedGroups, thirdsAdvance = BEST_THIRDS_ADVANCE)` — returns who reaches R32:
- top 2 of every **complete** group, always;
- the `thirdsAdvance` (**8**) best third-placed teams, ranked globally with `compareStandings`, **only once all `expectedGroups` are complete** (`allGroupsComplete`). Returns `{ advancing: Set<team_id>, byGroup: Map, thirds: ranked[], allGroupsComplete }`.
- The orchestrator passes `thirdsAdvance = hasR32 ? BEST_THIRDS_ADVANCE : 0`, and `expectedGroups` = distinct group codes among group-stage fixtures.

`scoreGroupQualificationPrediction(p, advancingTeamIds, rules)` — **25 points per hit** (`team_correct`) for each predicted team in the global `advancing` set. No penalty for wrong picks. Teams from incomplete groups (and unresolved thirds) are absent from the set → score 0 until they resolve.

`/admin/standings` renders the live per-group tables + the ranked thirds (top 8 marked `Clasifica` once `allGroupsComplete`, else `Pasaría/Fuera` provisional).

## Stage multipliers

From `rules.stage_multipliers` (not the `stages.score_multiplier` column — catalog comment says scoring_rules is authoritative):

| Stage | Multiplier |
|-------|------------|
| group_stage | 1 |
| round_of_32 | 2 |
| round_of_16 | 2 |
| quarter_final | 2 |
| third_place | 2 |
| semi_final | 3 |
| final | 5 |

## UI helpers

### `maxPoints.ts`

- `maxPointsForFixture(stage, result)` — dynamic bar max: group 15; knockout 23/28/33 × multiplier based on whether ET/penalties occurred
- `MAX_POINTS_BY_STAGE` — theoretical ceiling with penalties (66, 99, 165, …)

### `breakdownLabels.ts`

Maps breakdown keys → Spanish labels for `BreakdownTable`, `BreakdownPopover`, category views on `/my-scores` and `/clasificacion/categoria`.

## Recalculation triggers (call sites)

| Caller | When |
|--------|------|
| `admin/results/actions.ts` | `confirmMatchResult`, `generateRandomResults` |
| `predictions/initial/actions.ts` | `saveInitialPredictions` |
| `admin/evaluaciones/actions.ts` | `setSubjectiveEvaluation` |
| `predictions/matches/actions.ts` | `saveAllMatchPredictions`, `generateRandomMatchPredictions` |
| `admin/results/actions.ts` | `generateKnockoutPairings` |
| `admin/reglas/actions.ts` | `recalculateScoringRules` (manual) |

## Smoke script

`npm run scoring:smoke` → `scripts/scoring/smoke-recalc.ts`:

- Requires `SUPABASE_SECRET_KEY`
- Refuses remote writes unless `--confirm-prod`
- Runs core recalc; prints row counts by `prediction_type`

## Database

### `scoring_rules`

`version`, `rules` jsonb, `active` boolean. Admin-only write RLS.

### `prediction_scores`

`user_id`, `fixture_id` (null for initial/group_qual), `prediction_type`, `scoring_rules_version`, `points_total`, `points_breakdown`, `calculated_at`.

Full replace on each recalc — idempotent and safe to rerun after rule changes.

## Stale legacy notes

- Old PID/plan used 10/8/3 initial values and 1.4–2.0 float multipliers — **obsolete**
- `prediction_type` value `match` renamed to `group_phase` / `knockout` (migration `20260518120000`)
- Vitest unit tests were planned in hito 11; project uses smoke script instead
- Do not document `wc_2022_test` scoring seeds as current

## Related docs

- Spanish player guide: `documentation/user_guides/puntuacion.md`
- Recalculation how-to (planned): `documentation/implementations/scoring-recalculation.md` (Phase 2 implementations)
