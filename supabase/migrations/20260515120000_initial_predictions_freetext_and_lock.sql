-- ============================================================================
-- Migration: initial predictions — free-text scorer/best player + global lock
-- ----------------------------------------------------------------------------
-- 1. D2: the `players` table stays empty by design. Replace the dead FK
--    columns top_scorer_player_id / best_player_id with free-text columns
--    (the admin reconciles names by hand when scoring, hito 11).
-- 2. Tournament-level lock for initial + group-qualification predictions:
--    predictions_open_until if set, else min(kickoff_at) — i.e. editable
--    until the tournament's FIRST match kicks off (no 24h margin here;
--    the 24h margin is for per-match predictions, hito 09).
-- 3. Make other users' initial predictions public once locked, and deny
--    writes past the lock at the RLS layer (mirrors match_predictions).
-- ============================================================================


-- ─────────────────────────── 1. D2: free-text columns ───────────────────────

alter table public.initial_predictions
  drop column top_scorer_player_id,
  drop column best_player_id,
  add  column top_scorer_text text
       check (top_scorer_text is null or char_length(top_scorer_text) between 1 and 80),
  add  column best_player_text text
       check (best_player_text is null or char_length(best_player_text) between 1 and 80);


-- ─────────────────────────── 2. Lock helper functions ───────────────────────
-- Mirror of public.is_fixture_locked. `stable`, not `immutable`, because the
-- result depends on now(). The "locked" boolean is what RLS and the app use;
-- the "lock_at" timestamp is exposed so the UI can show the cutoff.

create or replace function public.initial_predictions_lock_at(p_tournament_id uuid)
returns timestamptz
language sql
stable
as $$
  select coalesce(
    (select predictions_open_until
       from public.tournaments where id = p_tournament_id),
    (select min(kickoff_at)
       from public.fixtures where tournament_id = p_tournament_id)
  )
$$;

create or replace function public.are_initial_predictions_locked(p_tournament_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    now() >= public.initial_predictions_lock_at(p_tournament_id),
    false
  )
$$;


-- ─────────────────────────── 3. RLS · initial_predictions ───────────────────
-- Drop + recreate the own/select policies to fold in the global lock.
-- The admin-all policy is left untouched (admins bypass the lock).

drop policy "initial_predictions_select_own_or_admin" on public.initial_predictions;
drop policy "initial_predictions_insert_own"          on public.initial_predictions;
drop policy "initial_predictions_update_own"          on public.initial_predictions;
drop policy "initial_predictions_delete_own"          on public.initial_predictions;

-- Your own predictions are always visible. Everyone's become visible once
-- the tournament is locked (public comparison view). Admins see all.
create policy "initial_predictions_select_own_or_locked_or_admin"
  on public.initial_predictions for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.are_initial_predictions_locked(tournament_id)
    or public.is_admin()
  );

create policy "initial_predictions_insert_own_unlocked"
  on public.initial_predictions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );

create policy "initial_predictions_update_own_unlocked"
  on public.initial_predictions for update to authenticated
  using (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  )
  with check (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );

create policy "initial_predictions_delete_own_unlocked"
  on public.initial_predictions for delete to authenticated
  using (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );
-- initial_predictions_admin_all: unchanged.


-- ─────────────────────────── 3b. RLS · group_qualification_predictions ───────
-- Same shape as initial_predictions.

drop policy "gqp_select_own_or_admin" on public.group_qualification_predictions;
drop policy "gqp_insert_own"          on public.group_qualification_predictions;
drop policy "gqp_update_own"          on public.group_qualification_predictions;
drop policy "gqp_delete_own"          on public.group_qualification_predictions;

create policy "gqp_select_own_or_locked_or_admin"
  on public.group_qualification_predictions for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.are_initial_predictions_locked(tournament_id)
    or public.is_admin()
  );

create policy "gqp_insert_own_unlocked"
  on public.group_qualification_predictions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );

create policy "gqp_update_own_unlocked"
  on public.group_qualification_predictions for update to authenticated
  using (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  )
  with check (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );

create policy "gqp_delete_own_unlocked"
  on public.group_qualification_predictions for delete to authenticated
  using (
    user_id = (select auth.uid())
    and not public.are_initial_predictions_locked(tournament_id)
  );
-- gqp_admin_all: unchanged.
