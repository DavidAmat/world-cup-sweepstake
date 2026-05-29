> Context: [`context/web/match-predictions.md`](../../../context/web/match-predictions.md)

# Match Predictions — implementation detail

Routes, components, server actions, schemas, lock helper, and RLS for per-fixture predictions.

## File map

```
src/app/(app)/predictions/matches/
  page.tsx              Server Component: loads rounds, fixtures, preds, scores, results
  MatchesForm.tsx       Client Component: single form, all jornadas, editable + locked panels
  LockedFixturePanel.tsx Client: locked fixture UI, ranking expansion, breakdown popovers
  actions.ts            saveAllMatchPredictions, clearAllMatchPredictions, generateRandomMatchPredictions (button hidden), lock/unlock round
  schemas.ts            FixturePredictionSchema, readFixturePayload
  public/page.tsx       Public comparative view (?round=)
src/lib/predictions/
  matchLock.ts          getMatchLockState, isFixtureLocked
src/app/admin/results/
  actions.ts            lockRoundPredictions, unlockRoundPredictions (canonical admin entry)
```

## Locking

### Database

Migration `20260525120000_manual_round_predictions_lock.sql`:

- Adds `rounds.predictions_locked_at`, `rounds.predictions_locked_by`
- Redefines `is_fixture_locked(p_fixture_id)`:

```sql
select coalesce(
  (select r.predictions_locked_at is not null
     from public.fixtures f
     join public.rounds r on r.id = f.round_id
     where f.id = p_fixture_id),
  false
);
```

Previous versions used `app_now() >= kickoff_at - interval '24 hours'` — **removed**.

### `matchLock.ts`

`getMatchLockState(tournamentId)`:

1. `syncAppNowFromEnv()` — for FECHA_ACTUAL banner only; **does not** affect match lock
2. `rpc("app_now")` — surfaced for display
3. Select all `rounds` for tournament; build `lockedRoundIds: Set<string>` where `predictions_locked_at !== null`

`isFixtureLocked(roundId, lockedRoundIds)` — pure helper: `lockedRoundIds.has(roundId)`.

App lock state mirrors RLS (both read the same round column). No per-fixture RPC on read path.

### Admin lock actions

Two equivalent entry points (both `requireAdmin()`):

| Location | Functions |
|----------|-----------|
| `admin/results/actions.ts` | `lockRoundPredictions`, `unlockRoundPredictions` |
| `predictions/matches/actions.ts` | `lockRoundFromPredictions`, `unlockRoundFromPredictions` |

Both update `rounds` for `(tournament_id, code)`:

- Lock: `{ predictions_locked_at: now(), predictions_locked_by: userId }`
- Unlock: `{ predictions_locked_at: null, predictions_locked_by: null }`

Revalidate `/admin/results`, `/predictions/matches`, `/predictions/matches/public`.

Round codes validated against `ROUNDS` in `lib/fixtures/catalogs.ts`.

### RLS (`match_predictions`)

From migration `20260508164810_predictions.sql` (unchanged policies; function body changed):

| Policy | Rule |
|--------|------|
| `match_predictions_select_own_or_locked` | Own row OR `is_fixture_locked(fixture_id)` OR admin |
| `match_predictions_insert/update/delete_own_unlocked` | Own row AND NOT `is_fixture_locked(fixture_id)` |
| `match_predictions_admin_all` | Admin bypass |

## `match_predictions` columns (active)

| Column | Group | Knockout |
|--------|-------|----------|
| `home_goals_90`, `away_goals_90` | Required | Required |
| `predicts_extra_time` | false | true iff draw at 90' |
| `predicts_penalties` | false | optional if ET |
| `predicted_qualified_team_id` | null | required |
| `predicted_winner_team_id` | null | set equal to qualified on save |
| `home_goals_120`, `away_goals_120` | always null | always null (not used) |

Unique: `(fixture_id, user_id)`.

## Schemas (`schemas.ts`)

Form field naming per fixture id `fid`:

- `h90_<fid>`, `a90_<fid>` — 90' goals
- `et_<fid>`, `pen_<fid>` — checkboxes (knockout only)
- `qual_<fid>` — qualified team id (knockout only)

`readFixturePayload(formData, fixtureMeta)`:

- Both 90' empty → `{ kind: "skip" }` (partial save)
- Else → Zod parse with `superRefine` cross-rules (group vs knockout, draw ⇒ ET, etc.)

## `saveAllMatchPredictions(formData)`

1. `requireAuth()` + load all tournament fixtures
2. `getMatchLockState` → skip locked rounds
3. For each fixture with teams: `readFixturePayload`; collect rows or errors
4. Abort if validation errors or zero rows
5. `upsert` on `(fixture_id, user_id)` via server client (RLS)
6. `recalculateTournamentScores(tournament.id)`
7. Revalidate clasificacion paths; redirect `?ok=saved`

Does **not** call `rpc("is_fixture_locked")` per fixture — relies on `lockedRoundIds` + RLS.

## `clearAllMatchPredictions()`

`requireAuth()`. Loads fixtures + `getMatchLockState`; deletes the user's `match_predictions` for fixtures in **unlocked** rounds (`.eq(user_id).in(fixture_id, unlockedIds)`), then `recalculateTournamentScores`. Redirects `?ok=cleared` (or `?error=` if everything is locked). Backs the **"Limpiar predicciones"** button.

## `generateRandomMatchPredictions()`

`requireAuth()` only (not admin-gated in current code). **Still defined in `actions.ts`, but its button is commented out in `page.tsx`** (logic retained for future use).

For each open fixture with teams:

- Random 90' bucket: 40% home win / 30% draw / 30% away win
- Knockout: if draw → ET always, penalties 70% prob, coin-flip qualifier; if not draw → qualifier = 90' winner
- Upsert all rows + recalculate scores

## `/predictions/matches` page

Server Component loads:

- Rounds (ordered), fixtures with team joins and stage
- All `match_predictions`, `prediction_scores` (group_phase + knockout), confirmed `match_results`
- All profiles (for locked-panel rankings)

Builds `RoundVM[]` with per-fixture: lock state, saved prediction, score, real result, sorted `otherEntries`.

Renders `MatchesForm` with team filter list and admin flag.

Also renders the **"Limpiar predicciones"** form. (The random-generator form is commented out in `page.tsx`.)

## `MatchesForm.tsx` (client)

Single `<form action={saveAllMatchPredictions}>` wrapping all jornadas:

- Sticky header: unsaved count, team filter dropdown, bulk show/hide locked rankings, save button
- Anchor nav links `#r-<round_code>`
- Per jornada: admin lock/unlock buttons; knockout info callout
- Per fixture card:
  - Open → `Editable` subcomponent (NumberInput for goals; ET/pen/qual derived in JS via `derive()`)
  - Locked → `LockedFixturePanel`
  - No teams → disabled message

Client-side `derive()` keeps knockout fields consistent with server Zod before submit.

## `LockedFixturePanel.tsx`

Shows official result (if confirmed), user's prediction with points bar and breakdown popover, expandable ranking of all participants sorted by points. Responds to `bulkSignal` from parent for show/hide all rankings.

## `/predictions/matches/public` page

- `?round=` selects jornada (defaults to first locked round, else first available)
- Per fixture: if round not locked → warning; if locked → grid of user cards with 90' score and knockout extras

RLS ensures query only returns others' rows when locked.

## Round catalog

From `lib/fixtures/catalogs.ts` — `ROUNDS`:

| code | name |
|------|------|
| group_md1–3 | Jornada 1–3 |
| r32 | Dieciseisavos |
| r16 | Octavos |
| qf | Cuartos |
| sf | Semifinales |
| third | Tercer puesto |
| final | Final |

## Stale legacy notes (do not copy)

- Hito 09 plan: 24h auto-lock, `?round=` single-round form, per-round save action, 120' goal inputs, admin-only random generator, no client components.
- Current: manual round lock, all rounds on one page, `MatchesForm` client component, no 120' fields, random generator for any auth user.

## Verification

```bash
npm run dev
# Player: fill some open fixtures → Guardar
# Admin: Bloquear jornada on /admin/results or /predictions/matches
# Player: same jornada read-only; others' preds visible in LockedFixturePanel
# /predictions/matches/public?round=group_md1 — shows cards when locked

npm run typecheck
```

## Related docs

- Spanish locking guide: `documentation/user_guides/bloqueo_predicciones.md`
- Results entry (admin lock section): `documentation/services/web/results-entry.md` (Phase 2)
- Shared locking overview: `context/shared/prediction-locking.md`
