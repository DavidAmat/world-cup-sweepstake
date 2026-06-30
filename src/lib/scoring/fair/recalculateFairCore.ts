import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { DEFAULT_SCORING_RULES_V1 } from "../rules";
import { scoreGroupMatch, scoreKnockoutMatch } from "../scoreMatch";
import type { ScoringRulesV1, StageCode } from "../types";
import { deriveFairResult } from "./deriveFairResult";

// Fair recalculation orchestrator — a parallel of recalculateTournamentScoresCore.
//
// Pipeline (all by tournament_id, full delete + insert):
//   1. Load active scoring_rules (same source as the real engine).
//   2. Wipe fair_match_results + fair_prediction_scores for the tournament.
//   3. From every CONFIRMED real match_results row + fair_added_time_goals,
//      derive the "Resultado Justo" → insert fair_match_results.
//   4. Score every match_prediction against its fair result with the SAME pure
//      scorers → insert fair_prediction_scores (group_phase / knockout).
//   5. Copy initial + group_qualification rows VERBATIM from the real
//      prediction_scores (brief: those are NOT recomputed with fair results).
//
// Uses the admin / service-role client (bypasses RLS for the full rebuild).

const STAGE_CODES = new Set<StageCode>([
  "group_stage",
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
]);

function asStageCode(code: string): StageCode {
  return STAGE_CODES.has(code as StageCode) ? (code as StageCode) : "group_stage";
}

type FairPredictionScoreRow = {
  tournament_id: string;
  user_id: string;
  fixture_id: string | null;
  prediction_type: "group_phase" | "knockout" | "initial" | "group_qualification";
  scoring_rules_version: number;
  points_total: number;
  points_breakdown: Record<string, number | string>;
};

export async function recalculateFairTournamentScoresCore(
  supabase: SupabaseClient<Database>,
  tournamentId: string,
): Promise<{ fairResults: number; inserted: number }> {
  const { data: ruleRow } = await supabase
    .from("scoring_rules")
    .select("version, rules")
    .eq("tournament_id", tournamentId)
    .eq("active", true)
    .maybeSingle();
  const version = ruleRow?.version ?? 1;
  const rules: ScoringRulesV1 =
    (ruleRow?.rules as ScoringRulesV1 | null) ?? DEFAULT_SCORING_RULES_V1;

  // Wipe fair tables for this tournament (idempotent full rebuild).
  await supabase.from("fair_prediction_scores").delete().eq("tournament_id", tournamentId);
  await supabase.from("fair_match_results").delete().eq("tournament_id", tournamentId);

  const stagesRes = await supabase
    .from("stages")
    .select("id, code")
    .eq("tournament_id", tournamentId);
  const stageById = new Map((stagesRes.data ?? []).map((s) => [s.id, s.code]));

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, group_code, home_team_id, away_team_id, stage_id")
    .eq("tournament_id", tournamentId);

  type FixtureMeta = {
    id: string;
    stage_code: StageCode;
    home_team_id: string | null;
    away_team_id: string | null;
  };
  const fixtureById = new Map<string, FixtureMeta>();
  for (const f of fixtures ?? []) {
    fixtureById.set(f.id, {
      id: f.id,
      stage_code: asStageCode(stageById.get(f.stage_id) ?? "group_stage"),
      home_team_id: f.home_team_id,
      away_team_id: f.away_team_id,
    });
  }

  // Confirmed real results.
  const { data: results } = await supabase
    .from("match_results")
    .select(
      "fixture_id, home_goals_90, away_goals_90, went_extra_time, went_penalties, qualified_team_id",
    )
    .eq("tournament_id", tournamentId)
    .eq("result_status", "confirmed");

  // Added-time goals to subtract, keyed by fixture → team → goals.
  const { data: addedRows } = await supabase
    .from("fair_added_time_goals")
    .select("fixture_id, team_id, goals")
    .eq("tournament_id", tournamentId);
  const addedByFixture = new Map<string, Map<string, number>>();
  for (const a of addedRows ?? []) {
    let m = addedByFixture.get(a.fixture_id);
    if (!m) {
      m = new Map();
      addedByFixture.set(a.fixture_id, m);
    }
    m.set(a.team_id, a.goals);
  }

  // Derive + persist the fair results.
  type FairResult = {
    fixture_id: string;
    home_goals_90: number;
    away_goals_90: number;
    went_extra_time: boolean;
    went_penalties: boolean;
    qualified_team_id: string | null;
  };
  const fairByFixture = new Map<string, FairResult>();
  const fairResultRows: Array<{
    tournament_id: string;
    fixture_id: string;
    home_goals_90: number;
    away_goals_90: number;
    went_extra_time: boolean;
    went_penalties: boolean;
    winner_team_id: string | null;
    qualified_team_id: string | null;
  }> = [];

  for (const r of results ?? []) {
    const fx = fixtureById.get(r.fixture_id);
    if (!fx) continue;
    const isKnockout = fx.stage_code !== "group_stage";
    const added = addedByFixture.get(r.fixture_id);
    const addedHome = (fx.home_team_id && added?.get(fx.home_team_id)) || 0;
    const addedAway = (fx.away_team_id && added?.get(fx.away_team_id)) || 0;

    const fair = deriveFairResult({
      real: {
        home_goals_90: r.home_goals_90 ?? 0,
        away_goals_90: r.away_goals_90 ?? 0,
        went_extra_time: r.went_extra_time ?? false,
        went_penalties: r.went_penalties ?? false,
        qualified_team_id: r.qualified_team_id,
      },
      homeTeamId: fx.home_team_id,
      awayTeamId: fx.away_team_id,
      addedHome,
      addedAway,
      isKnockout,
    });

    fairByFixture.set(r.fixture_id, {
      fixture_id: r.fixture_id,
      home_goals_90: fair.home_goals_90,
      away_goals_90: fair.away_goals_90,
      went_extra_time: fair.went_extra_time,
      went_penalties: fair.went_penalties,
      qualified_team_id: fair.qualified_team_id,
    });
    fairResultRows.push({
      tournament_id: tournamentId,
      fixture_id: r.fixture_id,
      home_goals_90: fair.home_goals_90,
      away_goals_90: fair.away_goals_90,
      went_extra_time: fair.went_extra_time,
      went_penalties: fair.went_penalties,
      winner_team_id: fair.winner_team_id,
      qualified_team_id: fair.qualified_team_id,
    });
  }

  if (fairResultRows.length > 0) {
    await supabase.from("fair_match_results").insert(fairResultRows);
  }

  const rowsToInsert: FairPredictionScoreRow[] = [];

  // Match predictions → fair match scores.
  const matchPreds = await fetchAllRows((from, to) =>
    supabase
      .from("match_predictions")
      .select(
        "user_id, fixture_id, home_goals_90, away_goals_90, predicts_extra_time, predicts_penalties, predicted_qualified_team_id",
      )
      .eq("tournament_id", tournamentId)
      .order("id")
      .range(from, to),
  );

  for (const p of matchPreds) {
    const r = fairByFixture.get(p.fixture_id);
    if (!r) continue;
    const fx = fixtureById.get(p.fixture_id);
    if (!fx) continue;
    const isKnockout = fx.stage_code !== "group_stage";
    const pred = {
      user_id: p.user_id,
      fixture_id: p.fixture_id,
      home_goals_90: p.home_goals_90,
      away_goals_90: p.away_goals_90,
      predicts_extra_time: p.predicts_extra_time,
      predicts_penalties: p.predicts_penalties,
      predicted_qualified_team_id: p.predicted_qualified_team_id,
    };
    const out = isKnockout
      ? scoreKnockoutMatch(pred, r, fx.stage_code, rules)
      : scoreGroupMatch(pred, r, fx.stage_code, rules);
    rowsToInsert.push({
      tournament_id: tournamentId,
      user_id: p.user_id,
      fixture_id: p.fixture_id,
      prediction_type: isKnockout ? "knockout" : "group_phase",
      scoring_rules_version: version,
      points_total: out.total,
      points_breakdown: {
        ...out.breakdown,
        _subtotal: out.subtotal,
        _multiplier: out.multiplier,
      },
    });
  }

  // Initial + group_qualification: copy VERBATIM from the real scores. These
  // are NOT affected by the Resultado Justo (brief). The real prediction_scores
  // must be up to date — the fair recalc always runs after the real one.
  const realExtras = await fetchAllRows((from, to) =>
    supabase
      .from("prediction_scores")
      .select("user_id, fixture_id, prediction_type, scoring_rules_version, points_total, points_breakdown")
      .eq("tournament_id", tournamentId)
      .in("prediction_type", ["initial", "group_qualification"])
      .order("id")
      .range(from, to),
  );

  for (const s of realExtras) {
    rowsToInsert.push({
      tournament_id: tournamentId,
      user_id: s.user_id,
      fixture_id: s.fixture_id,
      prediction_type: s.prediction_type as "initial" | "group_qualification",
      scoring_rules_version: s.scoring_rules_version,
      points_total: Number(s.points_total),
      points_breakdown: (s.points_breakdown ?? {}) as Record<string, number | string>,
    });
  }

  if (rowsToInsert.length > 0) {
    await supabase.from("fair_prediction_scores").insert(rowsToInsert);
  }

  return { fairResults: fairResultRows.length, inserted: rowsToInsert.length };
}
