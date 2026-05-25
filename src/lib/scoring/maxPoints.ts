// Max points per match by stage, derived from the active rules v1
// and the rounding rules of `documentation/user_guides/puntuacion.md`:
//   group_stage   → 15  (5 outcome + 10 exact, x1)
//   round_of_32   → 66  (33 subtotal × 2)
//   round_of_16   → 66
//   quarter_final → 66
//   third_place   → 66
//   semi_final    → 99  (33 × 3)
//   final         → 165 (33 × 5)
//
// Kept as a static map: stage_multipliers do not change between
// editions, and reading from the active `scoring_rules` row at every
// page render is overkill for a leaderboard.

import type { StageCode } from "./types";

export const MAX_POINTS_BY_STAGE: Record<StageCode, number> = {
  group_stage: 15,
  round_of_32: 66,
  round_of_16: 66,
  quarter_final: 66,
  third_place: 66,
  semi_final: 99,
  final: 165,
};

export function maxPointsForStage(stage: StageCode): number {
  return MAX_POINTS_BY_STAGE[stage] ?? 15;
}

// Max for a single initial-prediction slot.
export const MAX_INITIAL_CHAMPION = 200;
export const MAX_INITIAL_RUNNER_UP = 150;
export const MAX_INITIAL_TOP_SCORER = 100;
export const MAX_INITIAL_BEST_PLAYER = 100;

// Max per qualified-team slot in group qualification.
export const MAX_GROUP_QUALIFICATION_SLOT = 5;
