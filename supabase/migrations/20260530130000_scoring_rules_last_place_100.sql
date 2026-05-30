-- ============================================================================
-- Migration: add `initial_predictions.last_place = 100` to the active rules
-- ----------------------------------------------------------------------------
-- Companion to 20260530120000_initial_predictions_last_place. The "último
-- clasificado de la porra" pick is worth 100 points, mirroring pichichi /
-- mejor jugador. We add the key to the active scoring_rules JSON in place
-- (same approach as 20260528130000_scoring_rules_group_qualification_25).
--
-- Idempotent: only touches the active row, and only if the key is missing,
-- so re-runs and admin-created versions that already set it are left alone.
-- Inactive historic rows stay untouched (audit trail of past scoring).
-- ============================================================================

update public.scoring_rules
set rules = jsonb_set(
  rules,
  '{initial_predictions,last_place}',
  to_jsonb(100),
  true
)
where active = true
  and (rules -> 'initial_predictions' -> 'last_place') is null;
