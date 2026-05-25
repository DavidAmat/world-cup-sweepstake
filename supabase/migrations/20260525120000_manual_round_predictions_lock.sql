-- ============================================================================
-- Migration: manual per-round prediction lock
-- ----------------------------------------------------------------------------
-- The previous rule was "predictions for a fixture lock automatically 24h
-- before kickoff" (see migration 20260517120000_is_fixture_locked_app_now).
-- That rule is removed. The admin now locks each round (group_md1,
-- group_md2, group_md3, r32, r16, qf, sf, third, final) explicitly from
-- /admin/results. While `rounds.predictions_locked_at` is NULL, predictions
-- for every fixture in that round are editable and other users' predictions
-- stay private (RLS on match_predictions only allows SELECT of others' rows
-- when is_fixture_locked() is true). Once the admin locks the round, those
-- fixtures become read-only and the predictions of every participant become
-- visible to anyone authenticated.
--
-- The RLS policies on match_predictions already call public.is_fixture_locked,
-- so redefining that single function propagates the new semantics without any
-- policy edits.
-- ============================================================================

alter table public.rounds
  add column if not exists predictions_locked_at timestamptz null,
  add column if not exists predictions_locked_by uuid null
    references public.profiles(user_id) on delete set null;

-- Redefine is_fixture_locked: based on the round's manual lock now.
create or replace function public.is_fixture_locked(p_fixture_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select r.predictions_locked_at is not null
      from public.fixtures f
      join public.rounds r on r.id = f.round_id
      where f.id = p_fixture_id
    ),
    false
  )
$$;
