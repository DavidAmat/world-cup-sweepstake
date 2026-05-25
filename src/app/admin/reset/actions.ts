"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

const DELETE_ORDER = [
  "prediction_scores",
  "leaderboard_snapshots",
  "match_goals",
  "match_results",
  "match_predictions",
  "initial_predictions",
  "group_qualification_predictions",
] as const;

type DeletableTable = (typeof DELETE_ORDER)[number];

const TABLE_MAP: Record<string, DeletableTable[]> = {
  initial_predictions: ["initial_predictions"],
  match_predictions: ["match_predictions"],
  group_qualification_predictions: ["group_qualification_predictions"],
  match_results: ["match_goals", "match_results"],
  prediction_scores: ["prediction_scores"],
  leaderboard_snapshots: ["leaderboard_snapshots"],
};

export async function resetTournamentData(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();

  const confirmText = formData.get("confirm")?.toString();
  if (confirmText !== "BORRAR") {
    redirect("/admin/reset?error=La+confirmaci%C3%B3n+no+coincide");
  }

  const tournamentId = formData.get("tournament_id")?.toString();
  if (!tournamentId) {
    redirect("/admin/reset?error=Torneo+no+especificado");
  }

  const tables = formData.getAll("tables[]").map(String);
  if (tables.length === 0) {
    redirect("/admin/reset?error=Selecciona+al+menos+una+tabla");
  }

  const toDelete = new Set<DeletableTable>();
  for (const t of tables) {
    for (const mapped of TABLE_MAP[t] ?? []) toDelete.add(mapped);
  }

  for (const table of DELETE_ORDER) {
    if (!toDelete.has(table)) continue;
    await supabase.from(table).delete().eq("tournament_id", tournamentId);
  }

  revalidatePath("/clasificacion", "layout");
  revalidatePath("/my-scores");
  revalidatePath("/predictions", "layout");
  revalidatePath("/admin/results");
  revalidatePath("/admin/reset");

  redirect("/admin/reset?ok=reset");
}
