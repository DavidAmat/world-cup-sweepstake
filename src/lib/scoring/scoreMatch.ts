import { applyStageMultiplier } from "./applyMultiplier";
import type {
  Breakdown,
  MatchPredictionInput,
  MatchResultInput,
  ScoringOutput,
  ScoringRulesV1,
  StageCode,
} from "./types";

function sign(x: number): -1 | 0 | 1 {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

function scoreMatchCommon(
  p: MatchPredictionInput,
  r: MatchResultInput,
  rules: ScoringRulesV1,
): Breakdown {
  const breakdown: Breakdown = {};

  if (sign(p.home_goals_90 - p.away_goals_90) === sign(r.home_goals_90 - r.away_goals_90)) {
    breakdown.correct_outcome_90 = rules.match.correct_outcome_90;
  }

  const exactScore = p.home_goals_90 === r.home_goals_90 && p.away_goals_90 === r.away_goals_90;
  if (exactScore) {
    breakdown.exact_score_90 = rules.match.exact_score_90;
    return breakdown;
  }

  const dh = Math.abs(p.home_goals_90 - r.home_goals_90);
  const da = Math.abs(p.away_goals_90 - r.away_goals_90);
  const homeKey = String(dh) as "0" | "1" | "2";
  const awayKey = String(da) as "0" | "1" | "2";
  if (rules.match.home_goals_distance[homeKey] !== undefined) {
    breakdown.home_goals_distance = rules.match.home_goals_distance[homeKey];
  }
  if (rules.match.away_goals_distance[awayKey] !== undefined) {
    breakdown.away_goals_distance = rules.match.away_goals_distance[awayKey];
  }

  const diffP = p.home_goals_90 - p.away_goals_90;
  const diffR = r.home_goals_90 - r.away_goals_90;
  if (diffP === diffR) {
    breakdown.goal_difference_exact = rules.match.goal_difference_exact;
  }

  return breakdown;
}

function buildOutput(
  breakdown: Breakdown,
  stageCode: StageCode,
  rules: ScoringRulesV1,
): ScoringOutput {
  const subtotal = Object.values(breakdown).reduce((acc, v) => acc + v, 0);
  const multiplier = rules.stage_multipliers[stageCode] ?? 1;
  const total = applyStageMultiplier(subtotal, stageCode, rules);
  return { subtotal, multiplier, total, breakdown };
}

export function scoreGroupMatch(
  p: MatchPredictionInput,
  r: MatchResultInput,
  stageCode: StageCode,
  rules: ScoringRulesV1,
): ScoringOutput {
  const breakdown = scoreMatchCommon(p, r, rules);
  return buildOutput(breakdown, stageCode, rules);
}

export function scoreKnockoutMatch(
  p: MatchPredictionInput,
  r: MatchResultInput,
  stageCode: StageCode,
  rules: ScoringRulesV1,
): ScoringOutput {
  const breakdown = scoreMatchCommon(p, r, rules);

  if (p.predicts_extra_time === r.went_extra_time) {
    breakdown.correct_extra_time = rules.knockout.correct_extra_time;
  }
  if (p.predicts_penalties === r.went_penalties) {
    breakdown.correct_penalties = rules.knockout.correct_penalties;
  }
  if (r.qualified_team_id !== null && p.predicted_qualified_team_id === r.qualified_team_id) {
    breakdown.correct_qualified_team = rules.knockout.correct_qualified_team;
  }

  return buildOutput(breakdown, stageCode, rules);
}
