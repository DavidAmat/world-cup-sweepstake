-- ============================================================================
-- Migration: match_results — stop requiring the 120' result
-- ----------------------------------------------------------------------------
-- User decision (hito 10, mirrors hito 09 / 20260517130000): a match result
-- only captures the 90' score, whether it went to extra time / penalties, and
-- which team won / advanced. The 120' score is NOT recorded. Drop the CHECK
-- that tied went_extra_time to the presence of home_goals_120 / away_goals_120.
--
-- The penalties ⇒ extra_time ∧ penalty_winner CHECK (match_results_check1)
-- stays. The home/away_goals_120 columns are kept (nullable, now unused) to
-- avoid a destructive drop; the app always writes them as NULL from now on.
-- ============================================================================

alter table public.match_results
  drop constraint match_results_check;
