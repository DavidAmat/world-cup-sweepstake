import type { ScoringRulesV1, StageCode } from "./types";

export function applyStageMultiplier(
  points: number,
  stageCode: StageCode,
  rules: ScoringRulesV1,
): number {
  const m = rules.stage_multipliers[stageCode] ?? 1;
  return Math.round(points * m * 100) / 100;
}
