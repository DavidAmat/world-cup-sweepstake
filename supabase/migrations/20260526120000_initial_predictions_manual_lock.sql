-- ============================================================================
-- Migration: manual initial-predictions lock
-- ----------------------------------------------------------------------------
-- Adds an explicit admin-override column to tournaments so the admin can
-- lock initial (and group-qualification) predictions from the UI at any
-- time, independently of the time-based cutoff that was already in place
-- (predictions_open_until / min(kickoff_at)).
--
-- When `initial_predictions_locked_at` is NOT NULL the predictions are
-- locked regardless of the time-based condition. Setting it back to NULL
-- reverts to the original time-based rule.
-- ============================================================================

alter table public.tournaments
  add column if not exists initial_predictions_locked_at timestamptz null;

-- Redefine are_initial_predictions_locked to also honour the manual column.
create or replace function public.are_initial_predictions_locked(p_tournament_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    -- Manual admin override: locked as soon as the column is set.
    (
      select initial_predictions_locked_at is not null
      from public.tournaments
      where id = p_tournament_id
    ),
    false
  )
  -- Time-based fallback: now >= lock cutoff.
  or coalesce(
    public.app_now() >= public.initial_predictions_lock_at(p_tournament_id),
    false
  )
$$;
