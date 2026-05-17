-- ============================================================================
-- Migration: match_predictions — stop requiring the predicted 120' result
-- ----------------------------------------------------------------------------
-- User decision (hito 09): a match prediction only captures the 90' result,
-- whether there will be extra time / penalties, and which team advances.
-- The predicted 120' score is NOT recorded. So drop the CHECK that tied
-- predicts_extra_time to the presence of home_goals_120 / away_goals_120.
--
-- The penalties ⇒ extra_time CHECK (match_predictions_check1) stays.
-- The home/away_goals_120 columns are kept (nullable, now unused by
-- predictions) to avoid a destructive drop on rows that already exist;
-- the app always writes them as NULL from now on.
-- ============================================================================

alter table public.match_predictions
  drop constraint match_predictions_check;
