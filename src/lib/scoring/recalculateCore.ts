import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { DEFAULT_SCORING_RULES_V1 } from "./rules";
import { scoreGroupMatch, scoreKnockoutMatch } from "./scoreMatch";
import { scoreInitialPrediction, type TournamentFinalOutcome } from "./scoreInitial";
import {
  computeGroupTables,
  computeAdvancingTeams,
  scoreGroupQualificationPrediction,
  BEST_THIRDS_ADVANCE,
  type FixtureForTable,
  type GroupQualificationPredictionInput,
} from "./scoreGroup";
import type { ScoringRulesV1, StageCode } from "./types";

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

type PredictionScoreRow = {
  tournament_id: string;
  user_id: string;
  fixture_id: string | null;
  prediction_type: "group_phase" | "knockout" | "initial" | "group_qualification";
  scoring_rules_version: number;
  points_total: number;
  points_breakdown: Record<string, number | string>;
};

export async function recalculateTournamentScoresCore(
  supabase: SupabaseClient<Database>,
  tournamentId: string,
): Promise<{ inserted: number }> {
  const { data: ruleRow } = await supabase
    .from("scoring_rules")
    .select("version, rules")
    .eq("tournament_id", tournamentId)
    .eq("active", true)
    .maybeSingle();
  const version = ruleRow?.version ?? 1;
  const rules: ScoringRulesV1 =
    (ruleRow?.rules as ScoringRulesV1 | null) ?? DEFAULT_SCORING_RULES_V1;

  await supabase.from("prediction_scores").delete().eq("tournament_id", tournamentId);

  const [stagesRes, roundsRes, teamsRes] = await Promise.all([
    supabase.from("stages").select("id, code").eq("tournament_id", tournamentId),
    supabase.from("rounds").select("id, code").eq("tournament_id", tournamentId),
    supabase.from("teams").select("id, code").eq("tournament_id", tournamentId),
  ]);

  const stageById = new Map((stagesRes.data ?? []).map((s) => [s.id, s.code]));
  const roundById = new Map((roundsRes.data ?? []).map((r) => [r.id, r.code]));
  const teamCodeById = new Map((teamsRes.data ?? []).map((t) => [t.id, t.code]));
  const hasR32 = (roundsRes.data ?? []).some((r) => r.code === "r32");

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, group_code, home_team_id, away_team_id, stage_id, round_id")
    .eq("tournament_id", tournamentId);

  type FixtureMeta = {
    id: string;
    stage_code: StageCode;
    round_code: string;
    group_code: string | null;
    home_team_id: string | null;
    away_team_id: string | null;
  };

  const fixtureById = new Map<string, FixtureMeta>();
  for (const f of fixtures ?? []) {
    const stageCodeRaw = stageById.get(f.stage_id) ?? "group_stage";
    const roundCodeRaw = roundById.get(f.round_id) ?? "";
    fixtureById.set(f.id, {
      id: f.id,
      stage_code: asStageCode(stageCodeRaw),
      round_code: roundCodeRaw,
      group_code: f.group_code,
      home_team_id: f.home_team_id,
      away_team_id: f.away_team_id,
    });
  }

  const { data: results } = await supabase
    .from("match_results")
    .select(
      "fixture_id, home_goals_90, away_goals_90, went_extra_time, went_penalties, qualified_team_id",
    )
    .eq("tournament_id", tournamentId)
    .eq("result_status", "confirmed");

  const resultByFixture = new Map(
    (results ?? []).map((r) => [
      r.fixture_id,
      {
        fixture_id: r.fixture_id,
        home_goals_90: r.home_goals_90 ?? 0,
        away_goals_90: r.away_goals_90 ?? 0,
        went_extra_time: r.went_extra_time ?? false,
        went_penalties: r.went_penalties ?? false,
        qualified_team_id: r.qualified_team_id,
      },
    ]),
  );

  const fixturesForTable: FixtureForTable[] = [];
  for (const f of fixtures ?? []) {
    const meta = fixtureById.get(f.id);
    if (!meta || meta.stage_code !== "group_stage") continue;
    if (!f.group_code || !f.home_team_id || !f.away_team_id) continue;
    const r = resultByFixture.get(f.id);
    if (!r) continue;
    fixturesForTable.push({
      fixture_id: f.id,
      group_code: f.group_code,
      home_team_id: f.home_team_id,
      away_team_id: f.away_team_id,
      home_team_code: teamCodeById.get(f.home_team_id) ?? "",
      away_team_code: teamCodeById.get(f.away_team_id) ?? "",
      home_goals_90: r.home_goals_90,
      away_goals_90: r.away_goals_90,
    });
  }
  const groupTables = computeGroupTables(fixturesForTable, 6);

  // Who advances to R32: top 2 per group + the best thirds (only when R32
  // exists for this tournament). The best-thirds ranking resolves once every
  // group is complete; until then group_qualification predictions for thirds
  // simply score 0.
  const groupCodesPresent = new Set<string>();
  for (const f of fixtures ?? []) {
    const meta = fixtureById.get(f.id);
    if (meta?.stage_code === "group_stage" && f.group_code) groupCodesPresent.add(f.group_code);
  }
  const advancingTeams = computeAdvancingTeams(
    groupTables,
    groupCodesPresent.size,
    hasR32 ? BEST_THIRDS_ADVANCE : 0,
  );

  let tournamentFinalOutcome: TournamentFinalOutcome = {
    champion_team_id: null,
    runner_up_team_id: null,
  };
  const finalFixture = [...fixtureById.values()].find((f) => f.round_code === "final");
  if (finalFixture) {
    const finalResult = resultByFixture.get(finalFixture.id);
    if (finalResult && finalResult.qualified_team_id) {
      const champion = finalResult.qualified_team_id;
      const runnerUp =
        finalFixture.home_team_id === champion
          ? finalFixture.away_team_id
          : finalFixture.home_team_id;
      tournamentFinalOutcome = {
        champion_team_id: champion,
        runner_up_team_id: runnerUp,
      };
    }
  }

  const rowsToInsert: PredictionScoreRow[] = [];

  const { data: matchPreds } = await supabase
    .from("match_predictions")
    .select(
      "user_id, fixture_id, home_goals_90, away_goals_90, predicts_extra_time, predicts_penalties, predicted_qualified_team_id",
    )
    .eq("tournament_id", tournamentId);

  for (const p of matchPreds ?? []) {
    const r = resultByFixture.get(p.fixture_id);
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

  const { data: initialPreds } = await supabase
    .from("initial_predictions")
    .select(
      "user_id, champion_team_id, runner_up_team_id, top_scorer_correct, best_player_correct, last_place_correct",
    )
    .eq("tournament_id", tournamentId);

  for (const ip of initialPreds ?? []) {
    const out = scoreInitialPrediction(
      {
        user_id: ip.user_id,
        champion_team_id: ip.champion_team_id,
        runner_up_team_id: ip.runner_up_team_id,
        top_scorer_correct: ip.top_scorer_correct,
        best_player_correct: ip.best_player_correct,
        last_place_correct: ip.last_place_correct,
      },
      tournamentFinalOutcome,
      rules,
    );
    if (out.total === 0 && Object.keys(out.breakdown).length === 0) continue;
    rowsToInsert.push({
      tournament_id: tournamentId,
      user_id: ip.user_id,
      fixture_id: null,
      prediction_type: "initial",
      scoring_rules_version: version,
      points_total: out.total,
      points_breakdown: {
        ...out.breakdown,
        _subtotal: out.subtotal,
        _multiplier: out.multiplier,
      },
    });
  }

  const { data: gqp } = await supabase
    .from("group_qualification_predictions")
    .select("user_id, group_code, team_id")
    .eq("tournament_id", tournamentId);

  const byUserGroup = new Map<string, GroupQualificationPredictionInput>();
  for (const row of gqp ?? []) {
    const key = `${row.user_id}::${row.group_code}`;
    let entry = byUserGroup.get(key);
    if (!entry) {
      entry = {
        user_id: row.user_id,
        group_code: row.group_code,
        predicted_team_ids: [],
      };
      byUserGroup.set(key, entry);
    }
    entry.predicted_team_ids.push(row.team_id);
  }

  for (const p of byUserGroup.values()) {
    const out = scoreGroupQualificationPrediction(p, advancingTeams.advancing, rules);
    if (out.total === 0 && Object.keys(out.breakdown).length === 0) continue;
    rowsToInsert.push({
      tournament_id: tournamentId,
      user_id: p.user_id,
      fixture_id: null,
      prediction_type: "group_qualification",
      scoring_rules_version: version,
      points_total: out.total,
      points_breakdown: {
        ...out.breakdown,
        _subtotal: out.subtotal,
        _multiplier: out.multiplier,
        _group: p.group_code,
      },
    });
  }

  if (rowsToInsert.length > 0) {
    await supabase.from("prediction_scores").insert(rowsToInsert);
  }

  return { inserted: rowsToInsert.length };
}
