"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { recalculateTournamentScores } from "@/lib/scoring/recalculate";
import { recalculateFairTournamentScores } from "@/lib/scoring/fair/recalculateFair";
import { ROUNDS, type RoundCode } from "@/lib/fixtures/catalogs";
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

  // ── La Porra Justa: stoppage-time ("al 90") goals ───────────────────────────
  // Purely additive — the real match_results write above is untouched. We store
  // the goals to subtract per team into fair_added_time_goals (replace all rows
  // for this fixture), then on confirm recompute the fair pipeline AFTER the
  // real one (so the copied initial / group_qualification rows are up to date).
  const parseAdded = (v: FormDataEntryValue | null): number => {
    const s = String(v ?? "").trim();
    if (s === "") return 0;
    const n = Number(s);
    return Number.isInteger(n) && n >= 0 ? n : NaN;
  };
  const addedHome = parseAdded(formData.get("fair_added_home"));
  const addedAway = parseAdded(formData.get("fair_added_away"));
  if (
    Number.isNaN(addedHome) ||
    Number.isNaN(addedAway) ||
    addedHome > r.home_goals_90 ||
    addedAway > r.away_goals_90
  ) {
    redirect(
      `${SELF(fixtureId)}?error=${encodeURIComponent(
        "Los goles al 90' deben ser enteros ≥ 0 y no superar el marcador de cada equipo.",
      )}`,
    );
  }

  await supabase.from("fair_added_time_goals").delete().eq("fixture_id", fixtureId);
  const addedRows = [
    addedHome > 0
      ? {
          tournament_id: tournament.id,
          fixture_id: fixture.id,
          team_id: fixture.home_team_id,
          goals: addedHome,
        }
      : null,
    addedAway > 0
      ? {
          tournament_id: tournament.id,
          fixture_id: fixture.id,
          team_id: fixture.away_team_id,
          goals: addedAway,
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
  if (addedRows.length > 0) {
    const { error: addErr } = await supabase.from("fair_added_time_goals").insert(addedRows);
    if (addErr) {
      redirect(`${SELF(fixtureId)}?error=${encodeURIComponent(addErr.message)}`);
    }
  }

  if (status === "confirmed") {
    await recalculateTournamentScores(tournament.id);
    await recalculateFairTournamentScores(tournament.id);
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

// ── Knockout pairing generator (testing aid) ─────────────────────────────────
// Picks 2 × n distinct teams from the tournament and assigns them at random
// to the n fixtures of a knockout round (no continuity from previous rounds —
// each round is reshuffled from the full 48). Wipes any predictions, results,
// and goals on the touched fixtures so they cannot end up pointing to teams
// that are no longer there. After re-pairing the orchestrator is invoked so
// `prediction_scores` is rebuilt consistently.

const KNOCKOUT_ROUNDS = new Set<RoundCode>(["r32", "r16", "qf", "sf", "third", "final"]);

// ── Per-round prediction lock toggle ─────────────────────────────────────────
// Replaces the old "kickoff − 24h" auto-lock. The admin explicitly closes a
// round before the first match of that round so participants can no longer
// edit their predictions and RLS exposes the predictions of all users to
// everyone authenticated.

async function toggleRoundLock(formData: FormData, action: "lock" | "unlock") {
  const { userId, supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();
  const roundCode = String(formData.get("round") ?? "") as RoundCode;
  if (!ROUNDS.some((r) => r.code === roundCode)) {
    redirect(`/admin/results?error=${encodeURIComponent("Jornada no válida.")}`);
  }

  const update =
    action === "lock"
      ? { predictions_locked_at: new Date().toISOString(), predictions_locked_by: userId }
      : { predictions_locked_at: null, predictions_locked_by: null };

  const { error } = await supabase
    .from("rounds")
    .update(update)
    .eq("tournament_id", tournament.id)
    .eq("code", roundCode);
  if (error) {
    redirect(`/admin/results?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/results");
  revalidatePath("/predictions/matches");
  revalidatePath("/predictions/matches/public");
  redirect(`/admin/results?ok=${action === "lock" ? "locked" : "unlocked"}`);
}

export async function lockRoundPredictions(formData: FormData) {
  await toggleRoundLock(formData, "lock");
}

export async function unlockRoundPredictions(formData: FormData) {
  await toggleRoundLock(formData, "unlock");
}

export async function generateKnockoutPairings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();

  const roundCode = String(formData.get("round") ?? "") as RoundCode;
  if (!KNOCKOUT_ROUNDS.has(roundCode)) {
    redirect(`/admin/results?error=${encodeURIComponent("Esta ronda no admite cruces.")}`);
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

  const { data: fixturesRaw } = await supabase
    .from("fixtures")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("round_id", round.id)
    .order("kickoff_at", { ascending: true });
  const fixtures = (fixturesRaw ?? []) as Array<{ id: string }>;
  if (fixtures.length === 0) {
    redirect(`${back}&error=${encodeURIComponent("No hay partidos en esta ronda.")}`);
  }

  const { data: teamsRaw } = await supabase
    .from("teams")
    .select("id")
    .eq("tournament_id", tournament.id);
  const teams = (teamsRaw ?? []) as Array<{ id: string }>;
  if (teams.length < fixtures.length * 2) {
    redirect(
      `${back}&error=${encodeURIComponent(
        `Equipos insuficientes (${teams.length}) para ${fixtures.length} partidos.`,
      )}`,
    );
  }

  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, fixtures.length * 2);

  const fixtureIds = fixtures.map((f) => f.id);
  // Drop any stale predictions, results, and goals on these fixtures BEFORE
  // re-pairing — otherwise FK-orphaned references survive (predicted_qualified
  // _team_id, qualified_team_id) and would no longer match the new teams.
  await supabase.from("match_goals").delete().in("fixture_id", fixtureIds);
  await supabase.from("match_results").delete().in("fixture_id", fixtureIds);
  await supabase.from("match_predictions").delete().in("fixture_id", fixtureIds);

  // PostgREST has no bulk UPDATE with per-row values, so loop. Volume is
  // tiny (max 16 for R32) — Promise.all to parallelise the round-trips.
  const errors: string[] = [];
  await Promise.all(
    fixtures.map(async (fx, i) => {
      const { error } = await supabase
        .from("fixtures")
        .update({
          home_team_id: picked[2 * i].id,
          away_team_id: picked[2 * i + 1].id,
          home_placeholder: null,
          away_placeholder: null,
        })
        .eq("id", fx.id);
      if (error) errors.push(error.message);
    }),
  );
  if (errors.length > 0) {
    redirect(`${back}&error=${encodeURIComponent(errors.join("; "))}`);
  }

  // Recompute scores now that predictions/results for this round are gone.
  // Other rounds keep their data, so the global recalculation is still valid.
  await recalculateTournamentScores(tournament.id);

  revalidatePath("/admin/results");
  redirect(`${back}&ok=pairings`);
}
