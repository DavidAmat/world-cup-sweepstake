import type { ScoringRulesV1 } from "./types";

export const DEFAULT_SCORING_RULES_V1: ScoringRulesV1 = {
  version: 1,
  match: {
    correct_outcome_90: 5,
    exact_score_90: 10,
    home_goals_distance: { "0": 3, "1": 2, "2": 1 },
    away_goals_distance: { "0": 3, "1": 2, "2": 1 },
    goal_difference_exact: 3,
  },
  knockout: {
    correct_extra_time: 5,
    correct_penalties: 5,
    correct_qualified_team: 8,
  },
  stage_multipliers: {
    group_stage: 1,
    round_of_32: 2,
    round_of_16: 2,
    quarter_final: 2,
    third_place: 2,
    semi_final: 3,
    final: 5,
  },
  initial_predictions: {
    champion: 200,
    runner_up: 150,
    top_scorer: 100,
    best_player: 100,
  },
  group_qualification: {
    team_correct: 25,
  },
};
