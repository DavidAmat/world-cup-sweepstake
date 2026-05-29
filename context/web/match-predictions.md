# Match Predictions

Per-fixture score predictions for every match in the tournament, with manual per-jornada locking and a public comparative view after lock.

## What it is

Each player predicts **every fixture** in `wc_2026`:

- **Group stage** (`stage.code = group_stage`): `home_goals_90` and `away_goals_90` only.
- **Knockout** (all other stages): 90' score plus whether there is **prórroga** and **penaltis**, and which **team qualifies**. The 120' score is **not** predicted or stored (dropped in migration `20260517130000`).

Predictions live in `match_predictions` (one row per `(fixture_id, user_id)`). Saving triggers a scoring recalculation so points appear immediately if results already exist.

## Locking (manual per jornada)

A **jornada** is a `rounds` row (`group_md1`–`group_md3`, `r32`, `r16`, `qf`, `sf`, `third`, `final`). The admin locks the whole round by setting `rounds.predictions_locked_at`.

| Round state | Player can edit | Others' predictions visible |
|-------------|-----------------|----------------------------|
| Open (`predictions_locked_at IS NULL`) | Yes | No (RLS) |
| Locked | No | Yes (all authenticated users) |

Postgres `is_fixture_locked(fixture_id)` reads the fixture's round lock flag. RLS on `match_predictions` uses this function — there is **no** auto-lock from kickoff time or `FECHA_ACTUAL` (the old 24h-before-kickoff rule was removed in `20260525120000`).

Admin lock/unlock from **`/admin/results`** (primary) or **`/predictions/matches`** (per-round buttons when logged in as admin).

See the Spanish user guide: `documentation/user_guides/bloqueo_predicciones.md`.

## Routes

- **`/predictions/matches`** — single scrollable page with all jornadas stacked; editable cards for open fixtures, `LockedFixturePanel` for locked ones. One **Guardar predicciones** saves every filled open fixture across all rounds (partial save OK). Optional team filter and anchor nav per jornada.
- **`/predictions/matches/public`** — jornada selector (`?round=`); shows all users' predictions per fixture only when that jornada is locked.

Both require authentication.

## Knockout UX rules (client + server)

The form derives knockout fields from the 90' score:

- Draw at 90' → prórroga required; penaltis optional; qualified team chosen freely.
- Not a draw → no prórroga/penaltis; qualified team must be the 90' winner.

Zod in `schemas.ts` mirrors these rules; DB CHECK still enforces `predicts_penalties ⇒ predicts_extra_time`.

## Fixtures without teams

Knockout placeholders with missing `home_team_id` or `away_team_id` render disabled ("Equipos por definir") — no inputs, skipped on save.

## Testing aid

**Generar predicciones aleatorias** on `/predictions/matches` fills all open fixtures for the **current user** with random plausible scores (any authenticated user; original hito plan said admin-only but code does not gate it).

## Scoring

Match predictions are scored in the scoring engine (not on this page). Locked fixtures show points and breakdown popovers when `prediction_scores` exist. See `context/web/scoring-engine.md` (Phase 2).

## Where to look deeper

- Implementation: `documentation/services/web/match-predictions.md`
- Locking (shared): `context/shared/prediction-locking.md`
- Admin results + lock UI: `context/web/results-entry.md` (Phase 2)
- User guide (Spanish): `documentation/user_guides/bloqueo_predicciones.md`
- RLS: `documentation/services/database/rls.md`
