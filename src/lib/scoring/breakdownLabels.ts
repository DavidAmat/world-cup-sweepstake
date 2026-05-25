// Labels and grouping for the per-breakdown keys that
// `recalculateCore.ts` writes to `prediction_scores.points_breakdown`.
//
// Visible order in the BreakdownTable follows `ORDERED_KEYS`. Keys
// prefixed with "_" are meta (subtotal / multiplier / group code) and
// must NOT appear as rows.

export type BreakdownGroup =
  | "match" // group + knockout common scoring
  | "knockout_extra" // extra-time, penalties, qualified team
  | "initial" // champion / runner_up / top_scorer / best_player
  | "group_qual"; // team_correct

export type BreakdownEntry = {
  key: string;
  label: string;
  group: BreakdownGroup;
};

export const BREAKDOWN_ENTRIES: BreakdownEntry[] = [
  { key: "correct_outcome_90", label: "Acertar quién gana (90′)", group: "match" },
  { key: "exact_score_90", label: "Resultado exacto (90′)", group: "match" },
  { key: "home_goals_distance", label: "Cercanía goles local", group: "match" },
  { key: "away_goals_distance", label: "Cercanía goles visitante", group: "match" },
  { key: "goal_difference_exact", label: "Diferencia de goles exacta", group: "match" },
  { key: "correct_extra_time", label: "Acertar si hay prórroga", group: "knockout_extra" },
  { key: "correct_penalties", label: "Acertar si hay penaltis", group: "knockout_extra" },
  { key: "correct_qualified_team", label: "Acertar equipo que pasa", group: "knockout_extra" },
  { key: "champion", label: "Campeón", group: "initial" },
  { key: "runner_up", label: "Subcampeón", group: "initial" },
  { key: "top_scorer", label: "Pichichi", group: "initial" },
  { key: "best_player", label: "Mejor jugador", group: "initial" },
  { key: "team_correct", label: "Equipo clasificado del grupo", group: "group_qual" },
];

export const BREAKDOWN_ENTRY_BY_KEY = new Map(BREAKDOWN_ENTRIES.map((e) => [e.key, e]));

export function isMetaKey(key: string): boolean {
  return key.startsWith("_");
}

// Category buckets shown in /clasificacion (Por categoría) and
// /my-scores. Each bucket reads from the breakdown keys + multiplies
// per row by `_multiplier` so the user sees post-multiplier totals.
export type CategoryBucket =
  | "match_outcome" // correct_outcome_90 + exact_score_90 + closeness + diff
  | "knockout_extra"
  | "initial"
  | "group_qualification";

export const CATEGORY_LABELS: Record<CategoryBucket, string> = {
  match_outcome: "Resultados de partido",
  knockout_extra: "Prórroga · penaltis · pasa",
  initial: "Predicciones iniciales",
  group_qualification: "Clasificados de grupo",
};

export const CATEGORY_DESCRIPTIONS: Record<CategoryBucket, string> = {
  match_outcome:
    "Acertar el ganador (o el empate), el resultado exacto, la cercanía con los goles de cada equipo y la diferencia de goles. Aplica el multiplicador de cada ronda.",
  knockout_extra:
    "Solo en eliminatorias: acertar si hay prórroga, si hay penaltis y qué equipo pasa de ronda. Aplica el multiplicador.",
  initial:
    "Campeón (200), subcampeón (150), pichichi (100) y mejor jugador (100). Los dos últimos los asigna el admin al cerrar el torneo.",
  group_qualification: "5 puntos por cada equipo acertado como clasificado de su grupo.",
};

const MATCH_KEYS = new Set([
  "correct_outcome_90",
  "exact_score_90",
  "home_goals_distance",
  "away_goals_distance",
  "goal_difference_exact",
]);

const KNOCKOUT_EXTRA_KEYS = new Set([
  "correct_extra_time",
  "correct_penalties",
  "correct_qualified_team",
]);

const INITIAL_KEYS = new Set(["champion", "runner_up", "top_scorer", "best_player"]);

const GQ_KEYS = new Set(["team_correct"]);

// Reads numeric value from a breakdown map ignoring meta keys.
function num(b: Record<string, unknown>, k: string): number {
  const v = b[k];
  return typeof v === "number" ? v : 0;
}

export function bucketFromBreakdown(
  breakdown: Record<string, unknown>,
): Record<CategoryBucket, number> {
  const multiplier = typeof breakdown._multiplier === "number" ? breakdown._multiplier : 1;
  const matchSubtotal = [...MATCH_KEYS].reduce((s, k) => s + num(breakdown, k), 0) * multiplier;
  const knockoutSubtotal =
    [...KNOCKOUT_EXTRA_KEYS].reduce((s, k) => s + num(breakdown, k), 0) * multiplier;
  const initialSubtotal = [...INITIAL_KEYS].reduce((s, k) => s + num(breakdown, k), 0) * multiplier;
  const gqSubtotal = [...GQ_KEYS].reduce((s, k) => s + num(breakdown, k), 0) * multiplier;
  return {
    match_outcome: matchSubtotal,
    knockout_extra: knockoutSubtotal,
    initial: initialSubtotal,
    group_qualification: gqSubtotal,
  };
}
