"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { recalculateTournamentScores } from "@/lib/scoring/recalculate";
import { readResultPayload } from "./schemas";

const SELF = (id: string) => `/admin/results/${id}`;

type FixtureRow = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  stage: { code: string } | null;
};

async function persistResult(formData: FormData, status: "draft" | "confirmed") {
  const { userId, supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();

  const fixtureId = String(formData.get("fixture_id") ?? "");
  if (!fixtureId) {
    redirect(`/admin/results?error=${encodeURIComponent("Falta el identificador del partido.")}`);
  }

  // Re-read the fixture server-side: teams and knockout flag are NEVER
  // trusted from the form. RLS (is_admin) gates the write.
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("id, home_team_id, away_team_id, stage:stages ( code )")
    .eq("id", fixtureId)
    .eq("tournament_id", tournament.id)
    .maybeSingle<FixtureRow>();

  if (!fixture) {
    redirect(`/admin/results?error=${encodeURIComponent("Partido no encontrado.")}`);
  }
  if (fixture.home_team_id == null || fixture.away_team_id == null) {
    redirect(
      `${SELF(fixtureId)}?error=${encodeURIComponent(
        "El partido no tiene los dos equipos asignados.",
      )}`,
    );
  }

  const isKnockout = (fixture.stage?.code ?? "group_stage") !== "group_stage";

  const res = readResultPayload(formData, {
    fixture_id: fixture.id,
    home_team_id: fixture.home_team_id,
    away_team_id: fixture.away_team_id,
    is_knockout: isKnockout,
  });
  if (!res.ok) {
    redirect(`${SELF(fixtureId)}?error=${encodeURIComponent(res.message)}`);
  }
  const d = res.data;

  // Derive the official winner and (for knockouts) the qualified team.
  let winnerTeamId: string | null = null;
  if (d.went_penalties) {
    winnerTeamId = d.penalty_winner_team_id;
  } else if (d.went_extra_time) {
    if (d.home_goals_120! > d.away_goals_120!) winnerTeamId = d.home_team_id;
    else if (d.away_goals_120! > d.home_goals_120!) winnerTeamId = d.away_team_id;
  } else {
    if (d.home_goals_90 > d.away_goals_90) winnerTeamId = d.home_team_id;
    else if (d.away_goals_90 > d.home_goals_90) winnerTeamId = d.away_team_id;
  }
  const qualifiedTeamId = d.is_knockout ? winnerTeamId : null;

  const { error: resErr } = await supabase.from("match_results").upsert(
    {
      tournament_id: tournament.id,
      fixture_id: d.fixture_id,
      home_goals_90: d.home_goals_90,
      away_goals_90: d.away_goals_90,
      went_extra_time: d.went_extra_time,
      home_goals_120: d.home_goals_120,
      away_goals_120: d.away_goals_120,
      went_penalties: d.went_penalties,
      penalty_winner_team_id: d.penalty_winner_team_id,
      winner_team_id: winnerTeamId,
      qualified_team_id: qualifiedTeamId,
      result_status: status,
      created_by: userId,
    },
    { onConflict: "fixture_id" },
  );
  if (resErr) {
    redirect(`${SELF(fixtureId)}?error=${encodeURIComponent(resErr.message)}`);
  }

  // Replace all goals for this fixture (delete + insert).
  const { error: delErr } = await supabase
    .from("match_goals")
    .delete()
    .eq("fixture_id", d.fixture_id);
  if (delErr) {
    redirect(`${SELF(fixtureId)}?error=${encodeURIComponent(delErr.message)}`);
  }

  if (d.goals.length > 0) {
    const goalRows = d.goals.map((g) => ({
      tournament_id: tournament.id,
      fixture_id: d.fixture_id,
      team_id: g.team_id,
      player_id: g.player_id,
      minute: g.minute,
      period: g.period ?? "unknown",
      own_goal: g.own_goal,
      penalty_goal: g.penalty_goal,
    }));
    const { error: goalsErr } = await supabase.from("match_goals").insert(goalRows);
    if (goalsErr) {
      redirect(`${SELF(fixtureId)}?error=${encodeURIComponent(goalsErr.message)}`);
    }
  }

  if (status === "confirmed") {
    await recalculateTournamentScores(tournament.id);
  }

  revalidatePath("/admin/results");
  revalidatePath(SELF(fixtureId));
  redirect(`${SELF(fixtureId)}?ok=${status}`);
}

export async function saveMatchResult(formData: FormData) {
  await persistResult(formData, "draft");
}

export async function confirmMatchResult(formData: FormData) {
  await persistResult(formData, "confirmed");
}
