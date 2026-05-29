# Initial Predictions

Tournament-wide predictions each user submits once (editable until the admin locks them): champion, runner-up, `pichichi`, `mejor jugador`, and group `clasificados`.

## What it is

Before match-by-match betting starts, every player fills in **initial predictions** for the single active tournament (`wc_2026` via `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG`):

| Field | Input | Scoring (active rules) |
|-------|-------|------------------------|
| Campeón | Team select | 200 pts if correct |
| Subcampeón | Team select | 150 pts if correct |
| Pichichi | Free text (1–80 chars) | 100 pts if admin marks correct |
| Mejor jugador | Free text (1–80 chars) | 100 pts if admin marks correct |
| Clasificados | Exactly **2 teams per group** (A–L), checkboxes, no order | 25 pts per correct team |

Champion, runner-up, pichichi, and mejor jugador can be saved partially (left empty). **Group clasificados are all-or-nothing on save:** all 12 groups must have exactly 2 teams selected.

Free-text awards (`pichichi`, `mejor jugador`) have no automatic match — the admin judges them later at `/admin/evaluaciones`.

## Locking

Initial predictions lock **manually** when the admin sets `tournaments.initial_predictions_locked_at` (Bloquear / Desbloquear buttons on `/predictions/initial`). Postgres function `are_initial_predictions_locked(tournament_id)` is the single source of truth; RLS on `initial_predictions` and `group_qualification_predictions` denies writes when locked.

There is **no** auto-lock from first kickoff or `FECHA_ACTUAL` anymore (removed in migration `20260527120000`).

While **unlocked**: each user sees only their own rows (RLS). After **lock**: all authenticated users can read everyone’s predictions; the form becomes read-only.

## Routes

- **`/predictions/initial`** — edit form (open) or read-only view (locked). Admins see lock/unlock controls.
- **`/predictions/initial/public`** — comparative view: one card per user, category filter (`?cat=`). Available only when locked; otherwise an informational message (no redirect).

Both require authentication (`requireAuth()`).

## Admin evaluaciones

**`/admin/evaluaciones`** — after the tournament, the admin compares each user’s `top_scorer_text` and `best_player_text` against FIFA’s official winners and sets `top_scorer_correct` / `best_player_correct` to acierto, fallo, or sin evaluar. Each change triggers a full scoring recalculation. Champion, runner-up, and group clasificados score automatically from results; only these two fields need manual judgment.

## Save side effects

`saveInitialPredictions` upserts `initial_predictions`, replaces `group_qualification_predictions` (delete-then-insert per user), then calls `recalculateTournamentScores` so leaderboards stay current even if group-stage results already exist.

When locked and all group-stage fixtures have confirmed results, the read-only page shows inline **clasificados** evaluation (+25 per hit).

## Data model (summary)

- **`initial_predictions`** — one row per `(tournament_id, user_id)`; team FKs for champion/runner-up; text columns for awards; nullable booleans for subjective evaluation.
- **`group_qualification_predictions`** — up to 2 rows per `(user, group, team)`; `predicted_position` is always `null` (order not predicted).

See `documentation/services/database/tables.md` for columns and constraints.

## Where to look deeper

- Implementation detail: `documentation/services/web/initial-predictions.md`
- Locking model (shared): `context/shared/prediction-locking.md`
- Scoring engine: `context/web/scoring-engine.md` (Phase 2)
- User-facing scoring (Spanish): `documentation/user_guides/puntuacion.md` (Phase 2)
- Auth / terms gate: `context/web/auth-and-profiles.md`
- Database RLS: `documentation/services/database/rls.md`
