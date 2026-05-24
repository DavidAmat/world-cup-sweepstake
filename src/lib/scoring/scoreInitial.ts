import type { Breakdown, ScoringOutput, ScoringRulesV1 } from "./types";

export type InitialPredictionInput = {
  user_id: string;
  champion_team_id: string | null;
  runner_up_team_id: string | null;
};

export type TournamentFinalOutcome = {
  champion_team_id: string | null;
  runner_up_team_id: string | null;
};

export function scoreInitialPrediction(
  p: InitialPredictionInput,
  outcome: TournamentFinalOutcome,
  rules: ScoringRulesV1,
): ScoringOutput {
  const breakdown: Breakdown = {};

  if (outcome.champion_team_id !== null) {
    if (p.champion_team_id === outcome.champion_team_id) {
      breakdown.champion = rules.initial_predictions.champion;
    }
    if (outcome.runner_up_team_id !== null && p.runner_up_team_id === outcome.runner_up_team_id) {
      breakdown.runner_up = rules.initial_predictions.runner_up;
    }
  }

  const subtotal = Object.values(breakdown).reduce((acc, v) => acc + v, 0);
  return { subtotal, multiplier: 1, total: subtotal, breakdown };
}
