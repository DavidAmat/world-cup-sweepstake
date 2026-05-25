-- ============================================================================
-- Migration: initial-predictions lock is admin-controlled only
-- ----------------------------------------------------------------------------
-- Drops the time-based fallback (`app_now() >= initial_predictions_lock_at`)
-- from `are_initial_predictions_locked`. Initial / group-qualification
-- predictions are now locked ONLY when the admin sets
-- `tournaments.initial_predictions_locked_at` from the UI.
--
-- Context: FECHA_ACTUAL / kickoff-based cutoff was used in early milestones
-- to auto-lock predictions on tournament start. The admin now toggles every
-- lock manually (rounds + initials), so the time-based branch only got in
-- the way (it blocked users before the admin had even locked anything).
--
-- The function shape (uuid -> boolean) is unchanged; RLS policies that
-- reference it keep working without modification.
-- ============================================================================

create or replace function public.are_initial_predictions_locked(p_tournament_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select initial_predictions_locked_at is not null
      from public.tournaments
      where id = p_tournament_id
    ),
    false
  )
$$;
