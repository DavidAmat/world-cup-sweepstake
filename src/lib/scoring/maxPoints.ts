// Max points per match. The "max" depends on what actually happened in
// the match because — since the scoring change in hito 12 — points for
// extra time and penalties are only awarded when those events really
// occur AND the user predicted them. A match decided in 90' therefore
// has a lower ceiling than one that went to penalties.
//
// Base per match: outcome (5) + exact score (10) + qualified team (8)
// = 23 in knockouts, 15 in group stage (no qualified-team bonus).
// Knockouts that went to ET add 5, those that went to penalties add
// another 5. Then everything is multiplied by the stage multiplier
// (defined in rules v1 — kept in sync here as a static map).

import type { StageCode } from "./types";

const STAGE_MULTIPLIERS: Record<StageCode, number> = {
  group_stage: 1,
  round_of_32: 2,
  round_of_16: 2,
  quarter_final: 2,
  third_place: 2,
  semi_final: 3,
  final: 5,
};

// Theoretical ceiling of a perfect prediction (assumes the match went
// to penalties, the best case). Used as a stable "potential max"
// reference (e.g. dashboards / tables that want one number per stage).
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

// Dynamic ceiling for a single fixture, given what actually happened:
//   - no result yet → assume best case (penalties) so the bar has a
//     meaningful upper bound while we wait for the admin to confirm.
//   - decided in 90' → 23 × multiplier (no ET, no penalty bonus).
//   - went to ET without penalties → 28 × multiplier.
//   - went to penalties → 33 × multiplier.
// Group-stage matches always have max 15 (no qualified-team bonus,
// no ET, no penalties — multiplier × 1).
export function maxPointsForFixture(
  stage: StageCode,
  result: { went_extra_time: boolean; went_penalties: boolean } | null,
): number {
  if (stage === "group_stage") return 15;
  const mult = STAGE_MULTIPLIERS[stage] ?? 1;
  let subtotal = 23; // outcome + exact + qualified
  if (result) {
    if (result.went_extra_time) subtotal += 5;
    if (result.went_penalties) subtotal += 5;
  } else {
    // Optimistic upper bound while the result is pending.
    subtotal += 10;
  }
  return subtotal * mult;
}

// Max for a single initial-prediction slot.
export const MAX_INITIAL_CHAMPION = 200;
export const MAX_INITIAL_RUNNER_UP = 150;
export const MAX_INITIAL_TOP_SCORER = 100;
export const MAX_INITIAL_BEST_PLAYER = 100;

// Max per qualified-team slot in group qualification.
export const MAX_GROUP_QUALIFICATION_SLOT = 5;
