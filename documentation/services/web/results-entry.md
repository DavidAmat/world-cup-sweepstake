> Context: [`context/web/results-entry.md`](../../../context/web/results-entry.md)

# Results Entry — implementation detail

Admin routes, `deriveResult`, goal handling, round lock, and testing generators.

## File map

```
src/app/admin/results/
  page.tsx                    list by jornada, lock grid, random/pairings buttons
  actions.ts                  persistResult, save/confirm, random results, lock, pairings
  schemas.ts                  MatchResultPayloadSchema, deriveResult, readResultPayload
  [fixtureId]/
    page.tsx                  load fixture, read-only vs edit mode
    ResultForm.tsx            client form (90', penalties, qualifier, goals list)
```

## Authorization

All routes and actions use `requireAdmin()` with the **server Supabase client** (RLS via `is_admin()`), not the service-role client. Policies `match_results_admin_all` and `match_goals_admin_all` grant admin full access.

## List page (`/admin/results`)

Query params: `round` (default `group_md1`), `ok`, `error`.

Sections:

1. **Summary** — confirmed vs draft counts for the tournament.
2. **Bloqueo de predicciones por jornada** — card per round with Bloquear/Desbloquear → `lockRoundPredictions` / `unlockRoundPredictions`.
3. **Jornada selector** — GET form over `ROUNDS` from `lib/fixtures/catalogs.ts`.
4. **Testing buttons** (hidden for group rounds: pairings only on knockout):
   - `generateKnockoutPairings` when `stage_code !== group_stage`
   - `generateRandomResults` always
5. **Fixtures table** — matchup, Madrid kickoff, score snippet, qualified team (knockout), status badge, link to detail.

Fixtures without both teams show "Sin equipos" (no entry link).

## Detail page (`/admin/results/[fixtureId]`)

Loads fixture with home/away teams, stage, round, existing `match_results`, `match_goals`, and active `players` for both squads.

| Condition | UI |
|-----------|-----|
| Missing teams | Warning + link to `/admin/fixtures` |
| `result_status = confirmed` and no `?edit=1` | Read-only summary + goal list + "Editar resultado" link |
| Otherwise | `ResultForm` |

Editing a confirmed result shows a warning: save returns to draft; confirm recalculates.

## `ResultForm.tsx` (client)

Posts to `saveMatchResult` or `confirmMatchResult` via separate submit buttons.

Fields:

- `home_goals_90`, `away_goals_90` — required numbers
- Knockout draw at 90': derived extra time (not a checkbox); `went_penalties` checkbox; `qualified_team_id` select (home/away)
- Knockout decided at 90': winner derived; qualifier auto-set server-side
- Dynamic goal rows → serialized in hidden `goals_json`

Client derives ET/qualifier preview to match `deriveResult` (no 120' inputs).

## Schemas (`schemas.ts`)

### `MatchResultPayloadSchema`

Server-injected: `fixture_id`, `home_team_id`, `away_team_id`, `is_knockout`.

User/form fields: 90' goals, `went_penalties`, `qualified_team_id`, `goals[]`.

Validation highlights:

- Penalties only on knockout draw at 90'
- Knockout draw requires `qualified_team_id` ∈ {home, away}
- Each goal's `team_id` must be home or away

### `deriveResult(payload) → DerivedResult`

Single source of truth (also used by `generateRandomResults`):

```text
Knockout + draw at 90':
  went_extra_time = true
  went_penalties = from form
  penalty_winner_team_id = qualified if penalties else null
  winner_team_id = qualified_team_id
  qualified_team_id = qualified_team_id
  home_goals_120 / away_goals_120 = null

Knockout + not draw:
  went_extra_time = false, went_penalties = false
  winner_team_id = qualified_team_id = 90' winner

Group:
  winner_team_id = 90' winner or null if draw
  qualified_team_id = null
  no ET/penalties
```

### `readResultPayload(formData, meta)`

Parses `goals_json`, coerces numeric fields, returns `{ ok, data }` or `{ ok: false, message }`.

## `persistResult(formData, status)`

Shared by save (draft) and confirm (confirmed):

1. `requireAdmin()` — re-load fixture from DB (teams/knockout never from form)
2. `readResultPayload` → `deriveResult`
3. Upsert `match_results` on `fixture_id` with `result_status`, `created_by`
4. Delete all `match_goals` for fixture; insert new rows (`period` defaults to `unknown`)
5. If `status === "confirmed"` → `recalculateTournamentScores(tournament.id)`
6. Revalidate list + detail; redirect `?ok=draft|confirmed`

## `generateRandomResults(formData)`

- Input: hidden `round` code
- For each fixture in round with both teams: random 90' bucket (40/30/30 home/draw/away), build payload, `deriveResult`, upsert as **confirmed**
- Delete goals on touched fixtures
- Recalculate scores

## `generateKnockoutPairings(formData)`

Knockout round codes: `r32`, `r16`, `qf`, `sf`, `third`, `final`.

1. Load N fixtures in round
2. Shuffle all tournament teams; take first `2N`
3. **Before** updating fixtures: delete `match_goals`, `match_results`, `match_predictions` for those fixture IDs (avoids orphaned FK references)
4. Loop: set `home_team_id`, `away_team_id`, clear placeholders
5. `recalculateTournamentScores`

Random pairing is **independent per round** (no bracket continuity from prior rounds) — intentional for dev/testing after hito 11b.

## Round lock actions

Same implementation as match predictions admin path:

```ts
lock:   { predictions_locked_at: now(), predictions_locked_by: userId }
unlock: { predictions_locked_at: null, predictions_locked_by: null }
```

Updates `rounds` where `(tournament_id, code)`. Revalidates `/admin/results`, `/predictions/matches`, `/predictions/matches/public`.

Duplicate entry points: here and `predictions/matches/actions.ts` (`lockRoundFromPredictions`).

## Database

### `match_results`

Key columns: `home_goals_90`, `away_goals_90`, `went_extra_time`, `went_penalties`, `penalty_winner_team_id`, `winner_team_id`, `qualified_team_id`, `result_status` (`draft` | `confirmed`), `created_by`.

Unique: `(fixture_id)`.

Migration `20260517140000` dropped the CHECK tying extra time to 120' goals.

### `match_goals`

Per-goal: `team_id`, `player_id` (nullable), `minute`, `period`, `own_goal`, `penalty_goal`.

### RLS

- Authenticated users can **read** results and goals (leaderboards, locked panels)
- **Write** admin only

## Stale legacy notes

- Original hito 10 plan: 120' inputs, ET checkbox, service-role client, empty recalculate stub — all superseded.
- Hito 11b migrated tournament to **wc_2026** (104 fixtures, R32); pairings generator added on this page.
- Do not document `wc_2022_test` as current.

## Verification

```bash
# Admin: /admin/results → pick jornada → Introducir on a fixture
# Save draft → no leaderboard change
# Confirm → scores recalculate

# Lock jornada from same page → predictions frozen on /predictions/matches

npm run typecheck
npm run scoring:smoke   # after confirmed results exist
```

## Related docs

- Locking user guide (Spanish): `documentation/user_guides/bloqueo_predicciones.md`
- Match predictions UI: `documentation/services/web/match-predictions.md`
- Knockout pairings how-to (planned): `documentation/implementations/knockout-pairings-generation.md` (Phase 2 implementations index)
