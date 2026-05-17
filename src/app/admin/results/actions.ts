"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { recalculateTournamentScores } from "@/lib/scoring/recalculate";
import { ROUNDS } from "@/lib/fixtures/catalogs";
import { readResultPayload, deriveResult, type MatchResultPayload } from "./schemas";

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

  const r = deriveResult(res.data);

  const { error: resErr } = await supabase.from("match_results").upsert(
    {
      tournament_id: tournament.id,
      fixture_id: res.data.fixture_id,
      ...r,
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
    .eq("fixture_id", res.data.fixture_id);
  if (delErr) {
    redirect(`${SELF(fixtureId)}?error=${encodeURIComponent(delErr.message)}`);
  }

  if (res.data.goals.length > 0) {
    const goalRows = res.data.goals.map((g) => ({
      tournament_id: tournament.id,
      fixture_id: res.data.fixture_id,
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

// ── Random generator (testing aid) ───────────────────────────────────────────
// Same shape as generateRandomMatchPredictions (hito 09): dice for the 90'
// bucket, then a scoreline. A knockout drawn at 90' goes to extra time; a
// dice decides penalties; a coin flip picks who advances (we never track the
// 120' score). Fills every fixture of the selected round that has both teams,
// as a CONFIRMED result so it is immediately usable while developing.

const HOME_WIN = ["1-0", "2-0", "2-1", "3-0", "3-1", "3-2", "4-0", "4-1"];
const DRAW = ["0-0", "1-1", "2-2", "3-3"];
const AWAY_WIN = ["0-1", "0-2", "1-2", "0-3", "1-3", "2-3", "0-4", "1-4"];
const PENALTY_PROB = 0.7;

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const parse = (s: string): [number, number] => {
  const [h, a] = s.split("-").map(Number);
  return [h, a];
};

export async function generateRandomResults(formData: FormData) {
  const { userId, supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();

  const roundCode = ROUNDS.find((r) => r.code === String(formData.get("round") ?? ""))?.code;
  if (!roundCode) {
    redirect(`/admin/results?error=${encodeURIComponent("Jornada no válida.")}`);
  }
  const back = `/admin/results?round=${roundCode}`;

  const { data: round } = await supabase
    .from("rounds")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("code", roundCode)
    .maybeSingle();
  if (!round) {
    redirect(`${back}&error=${encodeURIComponent("Jornada no encontrada.")}`);
  }

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, home_team_id, away_team_id, stage:stages ( code )")
    .eq("tournament_id", tournament.id)
    .eq("round_id", round.id);

  const rows: Array<
    {
      tournament_id: string;
      fixture_id: string;
      result_status: "confirmed";
      created_by: string;
    } & ReturnType<typeof deriveResult>
  > = [];
  const touchedFixtureIds: string[] = [];

  for (const f of (fixtures ?? []) as FixtureRow[]) {
    if (f.home_team_id == null || f.away_team_id == null) continue;
    const isKnockout = (f.stage?.code ?? "group_stage") !== "group_stage";

    const roll = Math.random();
    const bucket = roll < 0.4 ? HOME_WIN : roll < 0.7 ? DRAW : AWAY_WIN;
    const [h90, a90] = parse(pick(bucket));
    const draw = h90 === a90;

    const payload: MatchResultPayload = {
      fixture_id: f.id,
      home_team_id: f.home_team_id,
      away_team_id: f.away_team_id,
      is_knockout: isKnockout,
      home_goals_90: h90,
      away_goals_90: a90,
      went_penalties: isKnockout && draw ? Math.random() < PENALTY_PROB : false,
      qualified_team_id:
        isKnockout && draw ? (Math.random() < 0.5 ? f.home_team_id : f.away_team_id) : null,
      goals: [],
    };

    rows.push({
      tournament_id: tournament.id,
      fixture_id: f.id,
      ...deriveResult(payload),
      result_status: "confirmed",
      created_by: userId,
    });
    touchedFixtureIds.push(f.id);
  }

  if (rows.length === 0) {
    redirect(`${back}&error=${encodeURIComponent("No hay partidos con equipos en esta jornada.")}`);
  }

  const { error: upErr } = await supabase
    .from("match_results")
    .upsert(rows, { onConflict: "fixture_id" });
  if (upErr) {
    redirect(`${back}&error=${encodeURIComponent(upErr.message)}`);
  }

  // The random generator does not create goals; clear any stale ones so the
  // recorded result and its goals stay consistent.
  await supabase.from("match_goals").delete().in("fixture_id", touchedFixtureIds);

  await recalculateTournamentScores(tournament.id);

  revalidatePath("/admin/results");
  redirect(`${back}&ok=random`);
}
