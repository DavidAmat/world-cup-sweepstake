"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { recalculateTournamentScores } from "@/lib/scoring/recalculate";

// Admin-only: rebuild prediction_scores for every user/fixture in the
// active tournament. Save flows already trigger this automatically; this
// button is a manual escape hatch (e.g. after editing rules directly in
// the DB, or when troubleshooting a discrepancy).
export async function recalculateClasificacion() {
  await requireAdmin();
  const tournament = await getDefaultTournament();
  await recalculateTournamentScores(tournament.id);

  revalidatePath("/clasificacion");
  revalidatePath("/clasificacion/jornada");
  revalidatePath("/clasificacion/fase");
  revalidatePath("/clasificacion/categoria");
  revalidatePath("/clasificacion/evolucion");
  revalidatePath("/my-scores");

  redirect("/clasificacion/jornada?ok=recalculated");
}
