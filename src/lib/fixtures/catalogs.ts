// Hardcoded catalog of stages and rounds for World Cup tournaments.
// Stable across editions (until FIFA changes the format) and shared
// between the seeder scripts (hito 06) and the admin UI (hito 07).
//
// `score_multiplier` mirrors the JSON of the active `scoring_rules`
// (hito 11). Source of truth for scoring is still `scoring_rules.rules`;
// this catalog only seeds the column on `stages` so it isn't misleading
// when an admin queries it directly.

export const STAGES = [
  { code: "group_stage", name: "Fase de grupos", sort_order: 1, score_multiplier: 1.0 },
  { code: "round_of_32", name: "Dieciseisavos de final", sort_order: 2, score_multiplier: 2.0 },
  { code: "round_of_16", name: "Octavos de final", sort_order: 3, score_multiplier: 2.0 },
  { code: "quarter_final", name: "Cuartos de final", sort_order: 4, score_multiplier: 2.0 },
  { code: "semi_final", name: "Semifinales", sort_order: 5, score_multiplier: 3.0 },
  { code: "third_place", name: "Tercer y cuarto puesto", sort_order: 6, score_multiplier: 2.0 },
  { code: "final", name: "Final", sort_order: 7, score_multiplier: 5.0 },
] as const;

export const ROUNDS = [
  { code: "group_md1", name: "Jornada 1", stage_code: "group_stage", sort_order: 1 },
  { code: "group_md2", name: "Jornada 2", stage_code: "group_stage", sort_order: 2 },
  { code: "group_md3", name: "Jornada 3", stage_code: "group_stage", sort_order: 3 },
  { code: "r32", name: "Dieciseisavos de final", stage_code: "round_of_32", sort_order: 4 },
  { code: "r16", name: "Octavos de final", stage_code: "round_of_16", sort_order: 5 },
  { code: "qf", name: "Cuartos de final", stage_code: "quarter_final", sort_order: 6 },
  { code: "sf", name: "Semifinales", stage_code: "semi_final", sort_order: 7 },
  { code: "third", name: "Tercer puesto", stage_code: "third_place", sort_order: 8 },
  { code: "final", name: "Final", stage_code: "final", sort_order: 9 },
] as const;

export type StageCode = (typeof STAGES)[number]["code"];
export type RoundCode = (typeof ROUNDS)[number]["code"];
