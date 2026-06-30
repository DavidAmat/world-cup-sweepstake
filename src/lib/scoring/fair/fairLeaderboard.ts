import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { madridDateKey } from "@/lib/dates/madridTime";
import type { LeaderboardData, ProfileRef, RoundRef, StageRef } from "../leaderboard";

// Fair-pipeline counterpart of loadLeaderboardData. Reads fair_prediction_scores
// instead of prediction_scores and returns the SAME LeaderboardData shape, so
// the existing aggregation builders (buildByRound, buildByStage, buildByCategory,
// buildEvolution, buildGeneralRanking) are reused verbatim.
export async function loadFairLeaderboardData(tournamentId: string): Promise<LeaderboardData> {
  const supabase = await createClient();

  const [profilesRes, scoresRaw, fixturesRes, roundsRes, stagesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, initials, role")
      .order("display_name", { ascending: true }),
    fetchAllRows((from, to) =>
      supabase
        .from("fair_prediction_scores")
        .select("user_id, fixture_id, prediction_type, points_total, points_breakdown")
        .eq("tournament_id", tournamentId)
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("fixtures")
      .select("id, round_id, stage_id, kickoff_at")
      .eq("tournament_id", tournamentId),
    supabase
      .from("rounds")
      .select("id, code, name, sort_order, stage:stages ( code )")
      .eq("tournament_id", tournamentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("stages")
      .select("code, name, sort_order")
      .eq("tournament_id", tournamentId)
      .order("sort_order", { ascending: true }),
  ]);

  const profiles = (profilesRes.data ?? []) as ProfileRef[];
  const rawScores = scoresRaw ?? [];
  const fixtures = fixturesRes.data ?? [];
  const rawRounds = (roundsRes.data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    sort_order: number;
    stage: { code: string } | null;
  }>;
  const rawStages = stagesRes.data ?? [];

  const scores = rawScores.map((s) => ({
    user_id: s.user_id,
    fixture_id: s.fixture_id as string | null,
    prediction_type: s.prediction_type as
      | "group_phase"
      | "knockout"
      | "initial"
      | "group_qualification",
    points_total: Number(s.points_total),
    points_breakdown: (s.points_breakdown ?? {}) as Record<string, unknown>,
  }));

  const rounds: RoundRef[] = rawRounds.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    sort_order: r.sort_order,
    stage_code: r.stage?.code ?? "group_stage",
  }));

  const stages: StageRef[] = rawStages.map((s) => ({
    code: s.code,
    name: s.name,
    sort_order: s.sort_order,
  }));

  const fixtureToRound = new Map<string, string>();
  const fixtureToStage = new Map<string, string>();
  const fixtureToDate = new Map<string, string>();
  const stageByRound = new Map<string, string>(rounds.map((r) => [r.id, r.stage_code]));
  for (const f of fixtures) {
    fixtureToRound.set(f.id, f.round_id);
    fixtureToStage.set(f.id, stageByRound.get(f.round_id) ?? "group_stage");
    if (f.kickoff_at) fixtureToDate.set(f.id, madridDateKey(f.kickoff_at as string));
  }

  return {
    profiles,
    scores,
    rounds,
    stages,
    fixtureToRound,
    fixtureToStage,
    fixtureToDate,
  };
}
