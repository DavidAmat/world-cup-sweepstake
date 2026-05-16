import "server-only";
import { createClient } from "@/lib/supabase/server";
import { syncAppNowFromEnv } from "@/lib/dates/appNow";

// Tournament-level lock for initial + group-qualification predictions.
//
// The lock instant is `predictions_open_until` (if the tournament row sets
// it) or the kickoff of the FIRST match otherwise: users can edit their
// initial predictions until any match of the tournament has started.
//
// The comparison instant is public.app_now() (real now(), or the simulated
// FECHA_ACTUAL when set). Both values are computed by Postgres so the lock
// stays a single source of truth shared with the RLS policies, and it
// sidesteps the Next 16 `react-hooks/purity` rule (no Date.now() in a
// Server Component). We sync the env override into app_settings first so
// the DB and the app agree on "now".

export type InitialLockState = {
  /** UTC ISO string of the cutoff, or null if it can't be determined. */
  lockAt: string | null;
  /** True once `app_now() >= lockAt`. */
  locked: boolean;
  /** UTC ISO of the simulated now (FECHA_ACTUAL), or null when not set. */
  fechaActual: string | null;
  /** True when the FECHA_ACTUAL override is active. */
  overriding: boolean;
};

export async function getInitialLockState(tournamentId: string): Promise<InitialLockState> {
  const { fechaActual, overriding } = await syncAppNowFromEnv();

  const supabase = await createClient();
  const [lockAtRes, lockedRes] = await Promise.all([
    supabase.rpc("initial_predictions_lock_at", { p_tournament_id: tournamentId }),
    supabase.rpc("are_initial_predictions_locked", { p_tournament_id: tournamentId }),
  ]);

  return {
    lockAt: (lockAtRes.data as string | null) ?? null,
    locked: lockedRes.data === true,
    fechaActual,
    overriding,
  };
}
