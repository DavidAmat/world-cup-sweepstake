-- ============================================================================
-- Migration: subjective initial predictions (pichichi / mejor jugador)
-- ----------------------------------------------------------------------------
-- `top_scorer_text` and `best_player_text` are free-text fields: there's no
-- canonical way to compare them to a FIFA-announced winner. At the end of
-- the tournament the admin reviews each user's text and marks whether it
-- counts as correct. The scoring engine then awards
-- `scoring_rules.initial_predictions.top_scorer` / `.best_player` points
-- to users whose flag is true; null/false → no points (no penalty).
--
-- Two nullable booleans on `initial_predictions`:
--   * `null`  → not evaluated yet (default).
--   * `true`  → admin marked it correct → points awarded on recalculation.
--   * `false` → admin marked it incorrect → no points.
--
-- Only the admin can touch these columns (handled in the server action;
-- existing RLS policies already restrict writes on `initial_predictions`
-- to the row owner pre-lock + admins via `initial_predictions_admin_all`).
-- ============================================================================

alter table public.initial_predictions
  add column top_scorer_correct  boolean,
  add column best_player_correct boolean;
