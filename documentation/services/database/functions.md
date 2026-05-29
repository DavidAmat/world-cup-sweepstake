> Context: [`context/07-database.md`](../../../context/07-database.md)

# Database Functions

SQL functions in `public` schema. Defined in `supabase/migrations/*`.

## set_updated_at()

| | |
|---|---|
| **Returns** | trigger |
| **Language** | plpgsql |
| **Security** | invoker (default) |

Trigger function: sets `NEW.updated_at = now()` before UPDATE on any table that attaches it.

Used on: `tournaments`, `profiles`, `teams`, `players`, `stages`, `rounds`, `fixtures`, `match_results`, `match_goals`, `player_match_stats`, all prediction tables, `scoring_rules`, `app_settings`.

## is_admin()

| | |
|---|---|
| **Returns** | boolean |
| **Language** | sql, STABLE |
| **Security** | DEFINER, `search_path = public` |

```sql
select exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid()) and p.role = 'admin'
)
```

RLS gate for admin policies. SECURITY DEFINER avoids recursive policy evaluation on `profiles`.

## app_now()

| | |
|---|---|
| **Returns** | timestamptz |
| **Language** | sql, STABLE |
| **Security** | DEFINER, `search_path = public` |

```sql
select coalesce(
  (select fecha_actual from public.app_settings where id),
  now()
)
```

Simulated "now" for testing. The Next app syncs `app_settings.fecha_actual` from `FECHA_ACTUAL` env var via service-role client. **Locking is admin-only** — `app_now()` no longer drives lock functions after migrations `20260525120000` / `20260527120000`. See `context/shared/dates-and-timezone.md`.

Migration: `20260516120000_app_now_override.sql`.

## initial_predictions_lock_at(p_tournament_id uuid)

| | |
|---|---|
| **Returns** | timestamptz |
| **Language** | sql, STABLE |

```sql
select coalesce(
  (select predictions_open_until from tournaments where id = p_tournament_id),
  (select min(kickoff_at) from fixtures where tournament_id = p_tournament_id)
)
```

Legacy helper for UI display of a theoretical cutoff. **Not used for locking** after migration `20260527120000` — locking is admin-only via `initial_predictions_locked_at`.

## are_initial_predictions_locked(p_tournament_id uuid)

| | |
|---|---|
| **Returns** | boolean |
| **Language** | sql, STABLE |

Current definition (admin-only):

```sql
select coalesce(
  (select initial_predictions_locked_at is not null
   from tournaments where id = p_tournament_id),
  false
)
```

Used by RLS on `initial_predictions` and `group_qualification_predictions` for read/write gating.

History:
- `20260515120000` — time-based (`now() >= lock_at`)
- `20260516120000` — switched to `app_now()`
- `20260526120000` — added manual override OR time-based
- `20260527120000` — **manual only** (time branch removed)

## is_fixture_locked(p_fixture_id uuid)

| | |
|---|---|
| **Returns** | boolean |
| **Language** | sql, STABLE |

Current definition (manual round lock):

```sql
select coalesce(
  (select r.predictions_locked_at is not null
   from fixtures f
   join rounds r on r.id = f.round_id
   where f.id = p_fixture_id),
  false
)
```

Used by RLS on `match_predictions`. When true: others' predictions become visible; writes denied for non-admins.

History:
- Original: `now() >= kickoff_at - 24h`
- `20260517120000` — switched to `app_now()`
- `20260525120000` — **manual round lock** (24h rule removed)

## handle_new_user()

| | |
|---|---|
| **Returns** | trigger |
| **Language** | plpgsql |
| **Security** | DEFINER, `search_path = public` |

Fires `AFTER INSERT ON auth.users`:
- Reads `raw_user_meta_data->>'display_name'`, falls back to email prefix.
- Inserts `profiles` row with `role = 'player'`, initials = first 2 chars uppercased.

Migration: `20260508170251_handle_new_user.sql`.

Trigger: `on_auth_user_created`.

## Auth schema (not public)

Supabase manages `auth.users` and JWT issuance. This app does not define custom auth functions.
