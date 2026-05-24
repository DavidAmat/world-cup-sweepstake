-- ============================================================================
-- Migration: rename prediction_type CHECK (match -> group_phase) and seed
-- scoring_rules v1 for the wc_2022_test tournament.
-- ----------------------------------------------------------------------------
-- - CHECK rename: 'match' -> 'group_phase' for self-documentation. No rows to
--   migrate (prediction_scores is still empty at this point).
-- - One scoring_rules row, active=true. Idempotent: ON CONFLICT
--   (tournament_id, version) DO NOTHING. When a new version lands (hito 14),
--   the editor will deactivate this row and activate the new one; the engine
--   reads whichever is active.
-- ============================================================================

-- 1. Replace the prediction_type CHECK.
alter table public.prediction_scores
  drop constraint prediction_scores_prediction_type_check;
alter table public.prediction_scores
  add constraint prediction_scores_prediction_type_check
  check (prediction_type in ('group_phase','initial','group_qualification','knockout'));

-- 2. Seed v1 rules for wc_2022_test.
insert into public.scoring_rules (tournament_id, version, rules, active)
select
  t.id,
  1,
  jsonb_build_object(
    'version', 1,
    'match', jsonb_build_object(
      'correct_outcome_90', 5,
      'exact_score_90', 10,
      'home_goals_distance', jsonb_build_object('0', 3, '1', 2, '2', 1),
      'away_goals_distance', jsonb_build_object('0', 3, '1', 2, '2', 1),
      'goal_difference_exact', 3
    ),
    'knockout', jsonb_build_object(
      'correct_extra_time', 5,
      'correct_penalties', 5,
      'correct_qualified_team', 8
    ),
    'stage_multipliers', jsonb_build_object(
      'group_stage', 1,
      'round_of_32', 2,
      'round_of_16', 2,
      'quarter_final', 2,
      'third_place', 2,
      'semi_final', 3,
      'final', 5
    ),
    'initial_predictions', jsonb_build_object(
      'champion', 200,
      'runner_up', 150,
      'top_scorer', 100,
      'best_player', 100
    ),
    'group_qualification', jsonb_build_object('team_correct', 5)
  ),
  true
from public.tournaments t
where t.slug = 'wc_2022_test'
on conflict (tournament_id, version) do nothing;
