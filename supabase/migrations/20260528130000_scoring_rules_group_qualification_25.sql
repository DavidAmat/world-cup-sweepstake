-- ============================================================================
-- Migration: bump `group_qualification.team_correct` to 25 in active rules
-- ----------------------------------------------------------------------------
-- The original seed (20260518120000_scoring_rules_seed_and_type_rename) wrote
-- `team_correct = 5`. We've since aligned every other source of truth on 25
-- (DEFAULT_SCORING_RULES_V1, /rules page, /predictions/initial overlay,
-- documentation/user_guides/puntuacion.md). Only the DB row lagged behind.
--
-- We update ONLY rows where the current value is 5 so the migration is
-- idempotent and doesn't stomp any admin-created versions that already use
-- a different number on purpose. Inactive historic rows are left untouched
-- (they're the audit trail of past scoring).
-- ============================================================================

update public.scoring_rules
set rules = jsonb_set(
  rules,
  '{group_qualification,team_correct}',
  to_jsonb(25),
  true
)
where active = true
  and (rules->'group_qualification'->>'team_correct')::int = 5;
