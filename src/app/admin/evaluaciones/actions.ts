"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateTournamentScores } from "@/lib/scoring/recalculate";

const SELF = "/admin/evaluaciones";
const VALID_FIELDS = new Set([
  "top_scorer_correct",
  "best_player_correct",
  "last_place_correct",
]);
const VALID_VALUES = new Set(["true", "false", "null"]);

function fail(message: string): never {
  redirect(`${SELF}?error=${encodeURIComponent(message)}`);
}

export async function setSubjectiveEvaluation(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("user_id") ?? "");
  const field = String(formData.get("field") ?? "");
  const rawValue = String(formData.get("value") ?? "");

  if (!userId) fail("Falta el identificador del participante.");
  if (!VALID_FIELDS.has(field)) fail("Campo de evaluación no válido.");
  if (!VALID_VALUES.has(rawValue)) fail("Valor de evaluación no válido.");

  const value: boolean | null = rawValue === "null" ? null : rawValue === "true";

  const tournament = await getDefaultTournament();
  const admin = createAdminClient();

  const patch =
    field === "top_scorer_correct"
      ? { top_scorer_correct: value }
      : field === "best_player_correct"
        ? { best_player_correct: value }
        : { last_place_correct: value };

  const { error } = await admin
    .from("initial_predictions")
    .update(patch)
    .eq("tournament_id", tournament.id)
    .eq("user_id", userId);
  if (error) fail(error.message);

  await recalculateTournamentScores(tournament.id);

  revalidatePath(SELF);
  revalidatePath("/clasificacion");
  revalidatePath("/clasificacion/categoria");
  revalidatePath("/clasificacion/jornada");
  revalidatePath("/my-scores");
  redirect(`${SELF}?ok=saved`);
}
