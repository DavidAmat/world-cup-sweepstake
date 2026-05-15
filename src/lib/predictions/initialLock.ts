import "server-only";
import { createClient } from "@/lib/supabase/server";

// Tournament-level lock for initial + group-qualification predictions.
//
// The lock instant is `predictions_open_until` (if the tournament row sets
// it) or the kickoff of the FIRST match otherwise: users can edit their
// initial predictions until any match of the tournament has started.
//
// Both values are computed by Postgres (via the SQL functions installed in
// migration 20260515120000) so `now()` lives in the DB, not in a Server
// Component — this sidesteps the Next 16 `react-hooks/purity` rule without
// `connection()` and keeps a single source of truth shared with the RLS
// policies.

export type InitialLockState = {
  /** UTC ISO string of the cutoff, or null if it can't be determined. */
  lockAt: string | null;
  /** True once `now() >= lockAt`. */
  locked: boolean;
};

export async function getInitialLockState(tournamentId: string): Promise<InitialLockState> {
  const supabase = await createClient();
  const [lockAtRes, lockedRes] = await Promise.all([
    supabase.rpc("initial_predictions_lock_at", { p_tournament_id: tournamentId }),
    supabase.rpc("are_initial_predictions_locked", { p_tournament_id: tournamentId }),
  ]);

  return {
    lockAt: (lockAtRes.data as string | null) ?? null,
    locked: lockedRes.data === true,
  };
}
