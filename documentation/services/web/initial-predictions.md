> Context: [`context/web/initial-predictions.md`](../../../context/web/initial-predictions.md)

# Initial Predictions — implementation detail

Routes, server actions, schemas, lock helpers, and admin evaluaciones for tournament-wide predictions.

## Tournament scope

`getDefaultTournament()` (`lib/tournament/getDefaultTournament.ts`) loads the row where `slug = NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG` (currently `wc_2026`). All initial-prediction pages and actions use this helper — there is no tournament picker UI.

## File map

```
src/app/(app)/predictions/initial/
  page.tsx              form + read-only + admin lock buttons + group eval UI
  actions.ts            saveInitialPredictions, lock/unlock (admin)
  schemas.ts            Zod + readInitialPayload
  public/page.tsx       comparative public view
src/lib/predictions/
  initialLock.ts        getInitialLockState → rpc are_initial_predictions_locked
src/app/admin/evaluaciones/
  page.tsx              subjective pichichi / mejor jugador evaluation
  actions.ts            setSubjectiveEvaluation
```

## Locking

### DB function

`are_initial_predictions_locked(p_tournament_id uuid) → boolean` (migration `20260527120000`):

```sql
select coalesce(
  (select initial_predictions_locked_at is not null
     from public.tournaments where id = p_tournament_id),
  false
);
```

Earlier migrations used kickoff-based cutoffs and `app_now()`; those branches were removed. Manual admin lock is the only mechanism now.

### App helper

`getInitialLockState(tournamentId)` in `initialLock.ts`:

- Server-only
- Single RPC: `are_initial_predictions_locked`
- Returns `{ locked: boolean }`

### Admin actions (`initial/actions.ts`)

| Action | Guard | Effect |
|--------|-------|--------|
| `lockInitialPredictions` | `requireAdmin()` + admin client | Sets `tournaments.initial_predictions_locked_at = now()` |
| `unlockInitialPredictions` | `requireAdmin()` + admin client | Sets column to `null` |

Uses `createAdminClient()` (service role) because players cannot update `tournaments`. Revalidates `/predictions/initial` and `/public`; redirects with `?ok=locked` or `?ok=unlocked`.

Lock/unlock buttons render on `initial/page.tsx` when `profile.role === 'admin'`.

### RLS (writes)

Policies on `initial_predictions` and `group_qualification_predictions` require `not are_initial_predictions_locked(tournament_id)` for player insert/update/delete. Select policy allows own rows always, all rows when locked, or admin.

## Schemas (`schemas.ts`)

```ts
GROUP_CODES = ["A"…"L"]   // 12 groups, wc_2026
MIN_QUALIFIERS = 2
MAX_QUALIFIERS = 3
// BEST_THIRDS_ADVANCE = 8 lives in src/lib/scoring/scoreGroup.ts
```

`InitialPredictionPayloadSchema`:

- `champion_team_id`, `runner_up_team_id` — UUID or null
- `top_scorer_text`, `best_player_text` — trimmed string 1–80 chars or null
- `qualifiers` — array of 12 `{ group_code, team_ids[] }` from checkbox `getAll('qual_<G>')`

`readInitialPayload(formData)` coerces empty strings to null (same pattern as `admin/fixtures/schemas.ts`).

The 2-or-3-per-group rule + "exactly 8 groups with 3" is validated in the action (Spanish errors).

## `saveInitialPredictions(formData)`

Flow:

1. `requireAuth()` + `getDefaultTournament()`
2. `getInitialLockState` — if locked → redirect `?error=Las predicciones iniciales ya están bloqueadas…`
3. `readInitialPayload` → Zod parse
4. Cross-validation:
   - Champion ≠ runner-up when both set
   - Each selected team belongs to its group and tournament
   - Each group has `MIN_QUALIFIERS`..`MAX_QUALIFIERS` (2–3) teams, and exactly `BEST_THIRDS_ADVANCE` (8) groups have 3
5. Upsert `initial_predictions` on `(tournament_id, user_id)`; preserve existing `submitted_at`
6. Delete all `group_qualification_predictions` for user; insert new rows with `predicted_position: null`
7. `recalculateTournamentScores(tournament.id)`
8. Revalidate paths; redirect `?ok=saved`

Uses the **server** Supabase client (RLS). No admin client for player saves.

## `/predictions/initial` page

Server Component. Loads teams, user’s `initial_predictions` + `gqp`, lock state, profile role.

**Open:** server-action form. Champion/runner-up `<select>` and pichichi/mejor-jugador text inputs are server-rendered; the clasificados section is the **`ClasificadosPicker`** client component (`ClasificadosPicker.tsx`), rendered inside the same `<form>` and owning the submit button. It holds checkbox state, caps each group at 3, shows per-group counts + a "grupos con 3: X/8" banner, and disables Guardar until exactly 8 groups have 3 (and every group ≥2). Checkboxes still post `name="qual_<G>" value="<team_id>"`, so the server action is unchanged and re-validates.

**Locked:** `ReadOnlyView` — champion, runner-up, texts, clasificados per group.

**Group evaluation block** (locked + all group-stage fixtures confirmed):

- Loads fixtures (`stage = group_stage`), confirmed `match_results`
- `computeGroupTables` → `computeAdvancingTeams` → `byGroup` = top 2 + each group's third if it ranks among the best 8
- Shows per-team hit/miss with +25 pts badges using `scoring_rules.group_qualification.team_correct` (default 25)

Does **not** redirect when locked (renders read-only — avoids Next.js streaming redirect issues).

## `/predictions/initial/public` page

- If not locked: warning that others’ predictions become public after admin lock; link back to own form
- If locked: loads all `profiles`, `initial_predictions`, `gqp`, teams
- Category via GET form `?cat=` ∈ `campeon | subcampeon | pichichi | mejor_jugador | clasificados`
- One card per profile; clasificados shows all 12 groups

RLS allows reading others’ rows only when locked.

## Admin evaluaciones

### Route

`/admin/evaluaciones` — `requireAdmin()`, admin client for reads/writes.

### Page

Lists every user with an `initial_predictions` row. Columns:

- Pichichi text + `top_scorer_correct` badge + evaluation buttons
- Mejor jugador text + `best_player_correct` badge + buttons

Point values shown from active `scoring_rules.initial_predictions` (default 100 / 100).

### `setSubjectiveEvaluation(formData)`

Fields: `user_id`, `field` (`top_scorer_correct` | `best_player_correct`), `value` (`true` | `false` | `null`).

1. `requireAdmin()`
2. Admin client updates the boolean column on `initial_predictions`
3. `recalculateTournamentScores(tournament.id)`
4. Revalidate clasificacion + my-scores paths
5. Redirect `?ok=saved`

Scoring engine reads the flags: `true` → award points; `null` or `false` → 0 (no penalty).

### Migration

`20260528120000_initial_predictions_subjective_evaluation.sql` adds nullable `top_scorer_correct`, `best_player_correct` to `initial_predictions`.

## Database tables touched

### `initial_predictions`

| Column | Notes |
|--------|-------|
| champion_team_id, runner_up_team_id | FK → teams |
| top_scorer_text, best_player_text | Free text; replaced dropped player FKs (migration `20260515120000`) |
| top_scorer_correct, best_player_correct | Admin-set; null = unevaluated |
| submitted_at | Set on first save, preserved on edits |
| locked_at | Column exists; lock is tournament-level via `tournaments.initial_predictions_locked_at` |

### `group_qualification_predictions`

| Column | Notes |
|--------|-------|
| group_code | A–L |
| team_id | FK → teams |
| predicted_position | Always `null` (multi-choice, no ordering) |

Unique: `(tournament_id, user_id, group_code, team_id)`.

### `tournaments.initial_predictions_locked_at`

Set/cleared by admin lock actions. Drives `are_initial_predictions_locked`.

## Scoring integration

On save and on evaluaciones update, `recalculateTournamentScores` recomputes `prediction_scores` with types:

- `initial` — champion, runner-up, subjective flags
- `group_qualification` — per correct team in group tables vs predictions

Authoritative point values: active `scoring_rules` JSON (200/150/100/100/25 in current prod rules).

## Verification

```bash
# As player (unlocked)
# → /predictions/initial shows form; save with 2 teams per group

# As admin
# → Bloquear on /predictions/initial
# → Player form becomes read-only; /predictions/initial/public shows all users

# Subjective
# → /admin/evaluaciones → mark pichichi acierto → leaderboard updates

npm run typecheck
npm run scoring:smoke   # if tournament seeded with predictions
```

## Stale legacy notes (do not copy)

- Original hito 08 plan used groups **A–H** and auto-lock from **first kickoff** / `predictions_open_until`. Current code: **A–L**, **admin-only** lock.
- `initial_predictions_lock_at` RPC may still exist but is **not** used by `are_initial_predictions_locked` after `20260527120000`.
- `players` table FKs for pichichi/mejor jugador were dropped; free text only.

## Related docs

- Locking overview: `context/shared/prediction-locking.md`
- Scoring engine: `documentation/services/web/scoring-engine.md` (Phase 2)
- `computeGroupTables`: `lib/scoring/scoreGroup.ts`
