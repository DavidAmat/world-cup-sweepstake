import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateTournamentScoresCore } from "./recalculateCore";

export async function recalculateTournamentScores(tournamentId: string): Promise<void> {
  const supabase = createAdminClient();
  await recalculateTournamentScoresCore(supabase, tournamentId);
}
