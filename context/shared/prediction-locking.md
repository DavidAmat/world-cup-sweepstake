# Prediction Locking

All prediction locks are **manual and admin-controlled**. No automatic cutoff from kickoff time, calendar date, or `FECHA_ACTUAL` / `app_now()`.

Two independent lock domains:

| Domain | Scope | DB flag | Postgres function |
|--------|-------|---------|-------------------|
| **Initial + clasificados** | Whole tournament | `tournaments.initial_predictions_locked_at` | `are_initial_predictions_locked(tournament_id)` |
| **Match predictions** | One jornada (`rounds` row) | `rounds.predictions_locked_at` | `is_fixture_locked(fixture_id)` |

RLS policies call these functions — the app helpers mirror them for UI gating.

## Match predictions (per jornada)

A **jornada** is a `rounds.code`: `group_md1`–`group_md3`, `r32`, `r16`, `qf`, `sf`, `third`, `final`.

| Round state | Player can edit own predictions | Others' predictions visible |
|-------------|--------------------------------|-----------------------------|
| Open (`predictions_locked_at IS NULL`) | Yes | No |
| Locked (`predictions_locked_at IS NOT NULL`) | No | Yes (all authenticated users) |

`is_fixture_locked(fixture_id)` joins `fixtures → rounds` and returns whether that round is locked. Every `match_predictions` RLS policy uses it — redefining the function changed behaviour without policy edits (migration `20260525120000`).

Also stored: `rounds.predictions_locked_by` (admin who locked; FK to `profiles`, nullable).

### App layer

- **`getMatchLockState(tournamentId)`** (`src/lib/predictions/matchLock.ts`) — syncs `FECHA_ACTUAL`, loads locked round IDs, returns `MatchLockState`
- **`isFixtureLocked(roundId, lockedRoundIds)`** — pure helper for pages/actions
- Used by `/predictions/matches`, `/predictions/matches/public`, and save actions

Side effect: `getMatchLockState` calls `syncAppNowFromEnv()` even though match locking no longer depends on `app_now()`. See `context/shared/dates-and-timezone.md`.

### Admin controls

- **`/admin/results`** — section "Bloqueo de predicciones por jornada" (primary)
- **`/predictions/matches`** — per-jornada Bloquear / Desbloquear for admins

Server actions: `lockRoundPredictions` / `unlockRoundPredictions` in `admin/results/actions.ts`; `lockRoundFromPredictions` / `unlockRoundFromPredictions` in `predictions/matches/actions.ts`.

Unlock reopens the jornada and hides others' predictions again.

## Initial predictions + group qualification

Champion, runner-up, pichichi, mejor jugador, and **clasificados** (2 teams per group) share one tournament-level lock.

| Tournament state | Player can edit | Others' rows visible |
|------------------|-----------------|----------------------|
| Open (`initial_predictions_locked_at IS NULL`) | Yes | No (except admin) |
| Locked | No | Yes |

`are_initial_predictions_locked(p_tournament_id)` returns `initial_predictions_locked_at IS NOT NULL` (migration `20260527120000` — time-based fallback removed).

RLS on both `initial_predictions` and `group_qualification_predictions` uses the same function.

### App layer

- **`getInitialLockState(tournamentId)`** (`src/lib/predictions/initialLock.ts`) — RPC `are_initial_predictions_locked`
- Used by `/predictions/initial`, public view, and save actions

### Admin controls

Bloquear / Desbloquear on **`/predictions/initial`** (sets/clears `tournaments.initial_predictions_locked_at` via admin client).

## History (do not re-document as current)

| Era | Match lock rule | Initial lock rule |
|-----|-----------------|-------------------|
| Early hito 09 | Auto: 24h before `kickoff_at` | Time: `app_now() >= lock_at(kickoff)` |
| `20260517120000` | Switched to `app_now()` for 24h rule | Same |
| `20260525120000` | **Manual per round** | unchanged |
| `20260526120000` | Manual | Manual OR time-based |
| `20260527120000` | Manual | **Manual only** |

Spanish user guide for players: `documentation/user_guides/bloqueo_predicciones.md`.

## RLS summary

| Table | Write when | Read others when |
|-------|------------|------------------|
| `match_predictions` | `not is_fixture_locked(fixture_id)` | `is_fixture_locked(fixture_id)` |
| `initial_predictions` | `not are_initial_predictions_locked(tournament_id)` | locked or admin |
| `group_qualification_predictions` | same as initial | same as initial |

Admins bypass via `is_admin()` on relevant policies.

## Testing locks locally

1. Promote an admin (`context/04-local-development.md`)
2. Lock from UI — no env var needed
3. Optional: `FECHA_ACTUAL` does **not** substitute for locking

To simulate "past jornadas already locked" in SQL:

```sql
update rounds set predictions_locked_at = now()
where tournament_id = (select id from tournaments where slug = 'wc_2026')
  and code in ('group_md1');
```

## Where to look deeper

- Match predictions feature: `context/web/match-predictions.md`
- Initial predictions feature: `context/web/initial-predictions.md`
- Admin lock UI in results: `context/web/results-entry.md`
- SQL definitions: `documentation/services/database/functions.md`
- RLS policies: `documentation/services/database/rls.md`
- User guide (Spanish): `documentation/user_guides/bloqueo_predicciones.md`
