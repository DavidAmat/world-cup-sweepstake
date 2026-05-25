import "server-only";
import { createClient } from "@/lib/supabase/server";

// Tournament-level lock for initial + group-qualification predictions.
//
// Admin-controlled only: the predictions are locked iff the admin has set
// `tournaments.initial_predictions_locked_at` from the UI. The DB function
// `are_initial_predictions_locked` is the single source of truth (RLS
// policies use the same function), and after migration
// 20260527120000 it no longer falls back to a time-based cutoff.

export type InitialLockState = {
  /** True iff the admin has locked initial predictions for this tournament. */
  locked: boolean;
};

export async function getInitialLockState(tournamentId: string): Promise<InitialLockState> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("are_initial_predictions_locked", {
    p_tournament_id: tournamentId,
  });

  return { locked: data === true };
}
