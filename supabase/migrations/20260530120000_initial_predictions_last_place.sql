-- ============================================================================
-- Migration: "último clasificado de la porra" initial prediction
-- ----------------------------------------------------------------------------
-- New initial prediction: each user guesses which *participant* (profile) they
-- think will finish LAST in the sweepstake leaderboard. It's a free pick from a
-- dropdown of every user; order/uniqueness across users does not matter.
--
-- Like pichichi / mejor jugador it is judged subjectively by the admin at the
-- end of the tournament (the admin decides which users guessed the eventual
-- last-placed participant correctly), so we mirror that pattern:
--
--   * `last_place_user_id`  → the profile this user bet will finish last
--                             (FK profiles.user_id; set null if that account
--                              is ever removed).
--   * `last_place_correct`  → admin evaluation flag:
--                               null  → not evaluated yet (default).
--                               true  → admin marked it correct → points awarded.
--                               false → admin marked it incorrect → no points.
--
-- The scoring engine awards `scoring_rules.initial_predictions.last_place`
-- points to users whose flag is true (see companion rules migration).
-- Writes are already gated by the existing initial_predictions RLS policies
-- (row owner pre-lock + admin via initial_predictions_admin_all).
-- ============================================================================

alter table public.initial_predictions
  add column last_place_user_id uuid references public.profiles(user_id) on delete set null,
  add column last_place_correct boolean;
