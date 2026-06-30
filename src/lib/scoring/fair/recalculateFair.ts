import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateFairTournamentScoresCore } from "./recalculateFairCore";

export async function recalculateFairTournamentScores(tournamentId: string): Promise<void> {
  const supabase = createAdminClient();
  await recalculateFairTournamentScoresCore(supabase, tournamentId);
}
