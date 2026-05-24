export type StageCode =
  | "group_stage"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export type ScoringRulesV1 = {
  version: 1;
  match: {
    correct_outcome_90: number;
    exact_score_90: number;
    home_goals_distance: Record<"0" | "1" | "2", number>;
    away_goals_distance: Record<"0" | "1" | "2", number>;
    goal_difference_exact: number;
  };
  knockout: {
    correct_extra_time: number;
    correct_penalties: number;
    correct_qualified_team: number;
  };
  stage_multipliers: Record<StageCode, number>;
  initial_predictions: {
    champion: number;
    runner_up: number;
    top_scorer: number;
    best_player: number;
  };
  group_qualification: {
    team_correct: number;
  };
};

export type MatchPredictionInput = {
  user_id: string;
  fixture_id: string;
  home_goals_90: number;
  away_goals_90: number;
  predicts_extra_time: boolean;
  predicts_penalties: boolean;
  predicted_qualified_team_id: string | null;
};

export type MatchResultInput = {
  fixture_id: string;
  home_goals_90: number;
  away_goals_90: number;
  went_extra_time: boolean;
  went_penalties: boolean;
  qualified_team_id: string | null;
};

export type Breakdown = Record<string, number>;

export type ScoringOutput = {
  subtotal: number;
  multiplier: number;
  total: number;
  breakdown: Breakdown;
};
