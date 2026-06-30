"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { recalculateFairTournamentScores } from "@/lib/scoring/fair/recalculateFair";

// Admin-only: rebuild fair_match_results + fair_prediction_scores from the
// current real results + fair_added_time_goals. Confirming a result already
// triggers this automatically; this button is the manual escape hatch (e.g.
// after seeding stoppage-time goals directly, or to refresh after a real
// recalc).
export async function recalculateFairClasificacion() {
  await requireAdmin();
  const tournament = await getDefaultTournament();
  await recalculateFairTournamentScores(tournament.id);

  revalidatePath("/porra-justa/clasificacion");
  revalidatePath("/porra-justa/predicciones");

  redirect("/porra-justa/clasificacion?ok=recalculated");
}
