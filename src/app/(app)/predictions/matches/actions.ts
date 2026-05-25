"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { getMatchLockState, isFixtureLocked } from "@/lib/predictions/matchLock";
import { ROUNDS, type RoundCode } from "@/lib/fixtures/catalogs";
import { recalculateTournamentScores } from "@/lib/scoring/recalculate";
import { readFixturePayload } from "./schemas";

const SELF = "/predictions/matches";

function back(params: string): never {
  redirect(`${SELF}?${params}`);
}

type FixtureRow = {
  id: string;
  kickoff_at: string;
  round_id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  stage: { code: string } | null;
};

const isKnockout = (f: FixtureRow) => (f.stage?.code ?? "group_stage") !== "group_stage";
const hasTeams = (
  f: FixtureRow,
): f is FixtureRow & { home_team_id: string; away_team_id: string } =>
  f.home_team_id != null && f.away_team_id != null;

// Upsert row shape (submitted_at intentionally omitted: DB default on insert,
// preserved on update since it is not in the update set).
type PredictionRow = {
  tournament_id: string;
  fixture_id: string;
  user_id: string;
  home_goals_90: number;
  away_goals_90: number;
  predicts_extra_time: boolean;
  home_goals_120: number | null;
  away_goals_120: number | null;
  predicts_penalties: boolean;
  predicted_winner_team_id: string | null;
  predicted_qualified_team_id: string | null;
};

// Single-page save: the form posts every editable fixture of the whole
// tournament (all rounds stacked on one page). We upsert the ones the user
// filled and skip empty / locked ones. Partial save is OK.
export async function saveAllMatchPredictions(formData: FormData) {
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, kickoff_at, round_id, home_team_id, away_team_id, stage:stages ( code )")
    .eq("tournament_id", tournament.id);

  const { lockedRoundIds } = await getMatchLockState(tournament.id);

  const rows: PredictionRow[] = [];
  const errors: string[] = [];

  for (const f of (fixtures ?? []) as FixtureRow[]) {
    if (!hasTeams(f)) continue;
    if (isFixtureLocked(f.round_id, lockedRoundIds)) continue; // RLS would reject too

    const res = readFixturePayload(formData, {
      id: f.id,
      is_knockout: isKnockout(f),
      home_team_id: f.home_team_id,
      away_team_id: f.away_team_id,
    });
    if (res.kind === "skip") continue;
    if (res.kind === "error") {
      errors.push(res.message);
      continue;
    }

    const p = res.data;
    rows.push({
      tournament_id: tournament.id,
      fixture_id: f.id,
      user_id: userId,
      home_goals_90: p.home_goals_90,
      away_goals_90: p.away_goals_90,
      predicts_extra_time: p.predicts_extra_time,
      // 120' result is not recorded (user decision); always cleared.
      home_goals_120: null,
      away_goals_120: null,
      predicts_penalties: p.predicts_penalties,
      predicted_winner_team_id: p.predicted_qualified_team_id,
      predicted_qualified_team_id: p.predicted_qualified_team_id,
    });
  }

  if (errors.length > 0) {
    back("error=" + encodeURIComponent(errors.slice(0, 4).join(" · ")));
  }
  if (rows.length === 0) {
    back("error=" + encodeURIComponent("No has rellenado ningún partido."));
  }

  const { error } = await supabase
    .from("match_predictions")
    .upsert(rows, { onConflict: "fixture_id,user_id" });
  if (error) back("error=" + encodeURIComponent(error.message));

  // Recompute prediction_scores so users who save after results are
  // confirmed see their points immediately on the leaderboard.
  await recalculateTournamentScores(tournament.id);

  revalidatePath(SELF);
  revalidatePath(`${SELF}/public`);
  revalidatePath("/clasificacion");
  revalidatePath("/my-scores");
  back("ok=saved");
}

// ── Random generator (admin only, testing aid) ───────────────────────────────
// Dice for the 90' category, then a scoreline from that bucket. Group games
// can end drawn (final). Knockout games drawn at 90' always go to extra time;
// PENALTY_PROB of those go to penalties; a 50/50 dice picks who advances
// regardless of the (irrelevant) extra-time score.

const HOME_WIN = ["1-0", "2-0", "2-1", "3-0", "3-1", "3-2", "4-0", "4-1"];
const DRAW = ["0-0", "1-1", "2-2", "3-3"];
const AWAY_WIN = ["0-1", "0-2", "1-2", "0-3", "1-3", "2-3", "0-4", "1-4"];
const PENALTY_PROB = 0.7;

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const parse = (s: string): [number, number] => {
  const [h, a] = s.split("-").map(Number);
  return [h, a];
};

export async function generateRandomMatchPredictions() {
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, kickoff_at, round_id, home_team_id, away_team_id, stage:stages ( code )")
    .eq("tournament_id", tournament.id);

  const { lockedRoundIds } = await getMatchLockState(tournament.id);

  const rows: PredictionRow[] = [];
  for (const f of (fixtures ?? []) as FixtureRow[]) {
    if (!hasTeams(f)) continue;
    if (isFixtureLocked(f.round_id, lockedRoundIds)) continue;

    const roll = Math.random();
    const bucket = roll < 0.4 ? HOME_WIN : roll < 0.7 ? DRAW : AWAY_WIN;
    const [h90, a90] = parse(pick(bucket));
    const knockout = isKnockout(f);

    const row: PredictionRow = {
      tournament_id: tournament.id,
      fixture_id: f.id,
      user_id: userId,
      home_goals_90: h90,
      away_goals_90: a90,
      predicts_extra_time: false,
      home_goals_120: null,
      away_goals_120: null,
      predicts_penalties: false,
      predicted_winner_team_id: null,
      predicted_qualified_team_id: null,
    };

    if (knockout) {
      if (h90 !== a90) {
        // Decided in 90'.
        const w = h90 > a90 ? f.home_team_id : f.away_team_id;
        row.predicted_winner_team_id = w;
        row.predicted_qualified_team_id = w;
      } else {
        // Drawn at 90' → extra time always. 120' score is not recorded;
        // a coin flip decides who advances (penalties or won in ET — we
        // only track that there was extra time and maybe penalties).
        row.predicts_extra_time = true;
        row.predicts_penalties = Math.random() < PENALTY_PROB;
        const w = Math.random() < 0.5 ? f.home_team_id : f.away_team_id;
        row.predicted_winner_team_id = w;
        row.predicted_qualified_team_id = w;
      }
    }

    rows.push(row);
  }

  if (rows.length === 0) {
    redirect(`${SELF}?error=${encodeURIComponent("No hay partidos abiertos que rellenar.")}`);
  }

  const { error } = await supabase
    .from("match_predictions")
    .upsert(rows, { onConflict: "fixture_id,user_id" });
  if (error) redirect(`${SELF}?error=${encodeURIComponent(error.message)}`);

  await recalculateTournamentScores(tournament.id);

  revalidatePath(SELF);
  revalidatePath(`${SELF}/public`);
  revalidatePath("/clasificacion");
  revalidatePath("/my-scores");
  redirect(`${SELF}?ok=random`);
}

// Admin-only: lock or unlock predictions for a round, from the predictions page.
async function toggleRoundLockFromPredictions(formData: FormData, action: "lock" | "unlock") {
  const { userId, supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();
  const roundCode = String(formData.get("round") ?? "") as RoundCode;
  if (!ROUNDS.some((r) => r.code === roundCode)) {
    redirect(`${SELF}?error=${encodeURIComponent("Jornada no válida.")}`);
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
    redirect(`${SELF}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/results");
  revalidatePath(SELF);
  revalidatePath(`${SELF}/public`);
  redirect(`${SELF}?ok=${action === "lock" ? "locked" : "unlocked"}`);
}

export async function lockRoundFromPredictions(formData: FormData) {
  await toggleRoundLockFromPredictions(formData, "lock");
}

export async function unlockRoundFromPredictions(formData: FormData) {
  await toggleRoundLockFromPredictions(formData, "unlock");
}
