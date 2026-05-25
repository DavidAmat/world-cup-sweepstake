"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { getInitialLockState } from "@/lib/predictions/initialLock";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateTournamentScores } from "@/lib/scoring/recalculate";
import { GROUP_QUALIFIERS, readInitialPayload } from "./schemas";

const SELF = "/predictions/initial";

export async function lockInitialPredictions() {
  await requireAdmin();
  const tournament = await getDefaultTournament();
  const admin = createAdminClient();
  await admin
    .from("tournaments")
    .update({ initial_predictions_locked_at: new Date().toISOString() })
    .eq("id", tournament.id);
  revalidatePath(SELF);
  revalidatePath(`${SELF}/public`);
  redirect(`${SELF}?ok=locked`);
}

export async function unlockInitialPredictions() {
  await requireAdmin();
  const tournament = await getDefaultTournament();
  const admin = createAdminClient();
  await admin
    .from("tournaments")
    .update({ initial_predictions_locked_at: null })
    .eq("id", tournament.id);
  revalidatePath(SELF);
  redirect(`${SELF}?ok=unlocked`);
}

function flatten(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}

function fail(message: string): never {
  redirect(`${SELF}?error=${encodeURIComponent(message)}`);
}

export async function saveInitialPredictions(formData: FormData) {
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();

  // Defence in depth: the RLS policies already deny writes past the
  // lock, but failing early gives the user a readable message instead
  // of an opaque RLS error.
  const { locked } = await getInitialLockState(tournament.id);
  if (locked) {
    fail("Las predicciones iniciales ya están bloqueadas: el torneo ha empezado.");
  }

  let payload;
  try {
    payload = readInitialPayload(formData);
  } catch (e) {
    fail(e instanceof z.ZodError ? flatten(e) : (e as Error).message);
  }

  if (
    payload.champion_team_id &&
    payload.runner_up_team_id &&
    payload.champion_team_id === payload.runner_up_team_id
  ) {
    fail("El campeón y el subcampeón no pueden ser el mismo equipo.");
  }

  // Load this tournament's teams to validate membership + group.
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, group_code")
    .eq("tournament_id", tournament.id);
  if (teamsErr || !teams) {
    fail("No se pudieron cargar los equipos del torneo.");
  }
  const groupByTeam = new Map<string, string | null>();
  for (const t of teams) groupByTeam.set(t.id, t.group_code);

  const ensureTeam = (id: string | null, label: string) => {
    if (id && !groupByTeam.has(id)) fail(`${label}: equipo no válido para este torneo.`);
  };
  ensureTeam(payload.champion_team_id, "Campeón");
  ensureTeam(payload.runner_up_team_id, "Subcampeón");

  // gqp rows to insert. Exactly GROUP_QUALIFIERS teams per group, every
  // group, no order (predicted_position = null). User decision: 0, 1 or
  // 3+ selected in any group is an error.
  const gqpRows: {
    tournament_id: string;
    user_id: string;
    group_code: string;
    team_id: string;
    predicted_position: null;
  }[] = [];

  for (const q of payload.qualifiers) {
    const { group_code } = q;
    const teamIds = [...new Set(q.team_ids)];
    if (teamIds.length !== GROUP_QUALIFIERS) {
      fail(
        `Grupo ${group_code}: tienes que seleccionar exactamente ${GROUP_QUALIFIERS} equipos (has marcado ${teamIds.length}).`,
      );
    }
    for (const tid of teamIds) {
      if (groupByTeam.get(tid) !== group_code) {
        fail(`Grupo ${group_code}: un equipo seleccionado no pertenece a ese grupo.`);
      }
      gqpRows.push({
        tournament_id: tournament.id,
        user_id: userId,
        group_code,
        team_id: tid,
        predicted_position: null,
      });
    }
  }

  // Keep the original submitted_at across edits.
  const { data: existing } = await supabase
    .from("initial_predictions")
    .select("submitted_at")
    .eq("tournament_id", tournament.id)
    .eq("user_id", userId)
    .maybeSingle();

  const { error: upsertErr } = await supabase.from("initial_predictions").upsert(
    {
      tournament_id: tournament.id,
      user_id: userId,
      champion_team_id: payload.champion_team_id,
      runner_up_team_id: payload.runner_up_team_id,
      top_scorer_text: payload.top_scorer_text,
      best_player_text: payload.best_player_text,
      submitted_at: existing?.submitted_at ?? new Date().toISOString(),
    },
    { onConflict: "tournament_id,user_id" },
  );
  if (upsertErr) fail(upsertErr.message);

  // Replace the user's group-qualification rows wholesale (D08-7).
  const { error: delErr } = await supabase
    .from("group_qualification_predictions")
    .delete()
    .eq("tournament_id", tournament.id)
    .eq("user_id", userId);
  if (delErr) fail(delErr.message);

  if (gqpRows.length > 0) {
    const { error: insErr } = await supabase
      .from("group_qualification_predictions")
      .insert(gqpRows);
    if (insErr) fail(insErr.message);
  }

  // Recompute prediction_scores so the leaderboard reflects this save
  // even when the user submits after match results were already
  // confirmed (otherwise their points stay at 0 until the next admin
  // recalc / result confirmation).
  await recalculateTournamentScores(tournament.id);

  revalidatePath(SELF);
  revalidatePath(`${SELF}/public`);
  revalidatePath("/clasificacion");
  revalidatePath("/my-scores");
  redirect(`${SELF}?ok=saved`);
}
