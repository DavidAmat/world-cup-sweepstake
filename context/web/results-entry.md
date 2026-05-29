# Results Entry

Admin UI to enter real match results by hand, lock jornadas for predictions, and (for testing) generate random results and knockout pairings.

## What it is

The admin records outcomes in **`match_results`** (one row per fixture) and optional **`match_goals`** (scorer detail). Results move through **`draft`** → **`confirmed`**. Only **confirmed** results trigger a full scoring recalculation.

Entry is manual — there is no live API or scraping integration.

## Routes

- **`/admin/results`** — fixture list filtered by jornada (`?round=`), per-jornada prediction lock controls, testing buttons (random results, knockout pairings).
- **`/admin/results/[fixtureId]`** — result form for one fixture; read-only when confirmed unless `?edit=1`.

Both require admin (`requireAdmin()` + `proxy.ts` gate).

## What gets recorded

| Phase | Admin enters | Derived server-side (`deriveResult`) |
|-------|--------------|--------------------------------------|
| Group | 90' score, optional goal list | No qualifier; draw → `winner_team_id` null |
| Knockout | 90' score, penaltis checkbox if draw, team that advances, optional goals | Draw at 90' → `went_extra_time: true`; winner/qualified from advance pick; no 120' score stored |

The 120' score columns exist in the schema but are always written **`null`** (same as match predictions).

Goal rows are optional. On each save the action **deletes all `match_goals` for the fixture** and re-inserts from the form's `goals_json`.

## Prediction lock (same page)

The results hub includes **Bloqueo de predicciones por jornada** — the same manual lock as documented in match predictions. Locking a round freezes player edits and exposes everyone's predictions for that jornada.

See `documentation/user_guides/bloqueo_predicciones.md` and `context/web/match-predictions.md`.

## Testing aids (admin only)

On `/admin/results` for the selected jornada:

- **Generar resultados aleatorios** — fills every fixture with both teams as **confirmed** results (uses `deriveResult`), clears goals, recalculates scores.
- **Generar cruces (esta ronda)** — knockout rounds only: randomly assigns 2×N teams from the full tournament to N fixtures, **deletes** existing predictions, results, and goals on those fixtures, then recalculates. For local/dev bracket experimentation — not FIFA-accurate progression.

## Scoring link

`confirmMatchResult` and the random-results generator call `recalculateTournamentScores`. Draft saves do not recalculate.

## Where to look deeper

- Implementation: `documentation/services/web/results-entry.md`
- Match predictions (lock semantics): `context/web/match-predictions.md`
- Scoring engine: `context/web/scoring-engine.md` (Phase 2)
- Fixtures / team assignment: `context/web/fixtures-admin.md` (Phase 2)
- Master data (wc_2026 calendar): `context/data/seeding-and-master-data.md` (Phase 2)
