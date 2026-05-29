> Context: [`context/07-database.md`](../../../context/07-database.md) · [`context/08-security.md`](../../../context/08-security.md)

# Row Level Security Policies

All `public` tables have RLS enabled. Policies use `(select auth.uid())` for plan caching. Admin bypass via `is_admin()` on every table.

## Policy naming convention

`<table>_<operation>_<rule>` — e.g. `match_predictions_select_own_or_locked`.

## tournaments

| Policy | Op | Rule |
|--------|-----|------|
| tournaments_select_authenticated | SELECT | all authenticated |
| tournaments_admin_all | ALL | `is_admin()` |

## profiles

| Policy | Op | Rule |
|--------|-----|------|
| profiles_select_authenticated | SELECT | all authenticated |
| profiles_update_own_no_role_change | UPDATE | own row; `role`, `must_change_password`, `is_scam` unchanged |
| profiles_admin_all | ALL | `is_admin()` |

No INSERT policy for regular users — `handle_new_user` trigger inserts via SECURITY DEFINER. The `must_change_password` flag is cleared by `changePassword` via the service-role client (the user cannot clear it themselves — pinned above).

## login_events

| Policy | Op | Rule |
|--------|-----|------|
| login_events_admin_all | ALL | `is_admin()` |

No user INSERT policy — the `signIn` action inserts via the service-role client (bypasses RLS).

## terms_acceptances

| Policy | Op | Rule |
|--------|-----|------|
| terms_acceptances_select_own_or_admin | SELECT | own or admin |
| terms_acceptances_insert_own | INSERT | own user_id |
| terms_acceptances_admin_all | ALL | `is_admin()` |

No user UPDATE/DELETE (audit trail).

## app_settings

| Policy | Op | Rule |
|--------|-----|------|
| app_settings_select_authenticated | SELECT | all authenticated |
| app_settings_admin_all | ALL | `is_admin()` |

App syncs via service-role client (bypasses RLS).

## Catalog tables (teams, players, stages, rounds)

Each table:
- `*_select_authenticated` — SELECT for all authenticated
- `*_admin_all` — ALL for `is_admin()`

## Fixtures and results (fixtures, match_results, match_goals, player_match_stats)

Same pattern as catalog: authenticated read, admin write.

## initial_predictions

| Policy | Op | Rule |
|--------|-----|------|
| initial_predictions_select_own_or_locked_or_admin | SELECT | own OR `are_initial_predictions_locked(tournament_id)` OR admin |
| initial_predictions_insert_own_unlocked | INSERT | own; not locked |
| initial_predictions_update_own_unlocked | UPDATE | own; not locked |
| initial_predictions_delete_own_unlocked | DELETE | own; not locked |
| initial_predictions_admin_all | ALL | `is_admin()` |

## group_qualification_predictions

| Policy | Op | Rule |
|--------|-----|------|
| gqp_select_own_or_locked_or_admin | SELECT | own OR locked OR admin |
| gqp_insert_own_unlocked | INSERT | own; not locked |
| gqp_update_own_unlocked | UPDATE | own; not locked |
| gqp_delete_own_unlocked | DELETE | own; not locked |
| gqp_admin_all | ALL | `is_admin()` |

Shares lock function with initial predictions (`are_initial_predictions_locked`).

## match_predictions

| Policy | Op | Rule |
|--------|-----|------|
| match_predictions_select_own_or_locked | SELECT | own OR `is_fixture_locked(fixture_id)` OR admin |
| match_predictions_insert_own_unlocked | INSERT | own; not locked |
| match_predictions_update_own_unlocked | UPDATE | own; not locked |
| match_predictions_delete_own_unlocked | DELETE | own; not locked |
| match_predictions_admin_all | ALL | `is_admin()` |

## Scoring tables (scoring_rules, prediction_scores, leaderboard_snapshots)

Each table:
- `*_select_authenticated` — SELECT for all authenticated
- `*_admin_all` — ALL for `is_admin()`

Recalculation engine uses service-role client (bypasses RLS) for bulk delete/insert on `prediction_scores` and `leaderboard_snapshots`.

## Service role bypass

`lib/supabase/admin.ts` uses `SUPABASE_SECRET_KEY` — bypasses all RLS. Used only server-side for:
- Scoring recalculation
- Seed scripts
- Tournament reset
- `app_settings` sync from env

## Anonymous access

No policies grant access to `anon` role on domain tables. Unauthenticated users cannot read predictions, scores, or profiles via the API.
