import "server-only";
import { createClient } from "@/lib/supabase/server";
import { syncAppNowFromEnv } from "@/lib/dates/appNow";

// Manual per-round prediction lock. The admin toggles each round
// (group_md1, group_md2, group_md3, r32, r16, qf, sf, third, final)
// from /admin/results: while `rounds.predictions_locked_at` is NULL the
// fixtures of that round are editable AND other users' predictions stay
// private (RLS on match_predictions reads public.is_fixture_locked()).
// Once the admin locks the round, the predictions become read-only and
// public.
//
// `app_now()` / FECHA_ACTUAL no longer drive the match-prediction lock
// (that was the "kickoff − 24h" rule, dropped in migration
// 20260525120000_manual_round_predictions_lock). We still surface the
// override in MatchLockState because the banner is shared between
// `/predictions/matches` and the initial-predictions lock screen.

export type MatchLockState = {
  /** UTC ISO of the DB's "now" (real now() or FECHA_ACTUAL). */
  appNow: string;
  /** UTC ISO of the simulated now (FECHA_ACTUAL), or null when not set. */
  fechaActual: string | null;
  /** True when the FECHA_ACTUAL override is active. */
  overriding: boolean;
  /** IDs of rounds the admin has manually locked. */
  lockedRoundIds: Set<string>;
};

export async function getMatchLockState(tournamentId: string): Promise<MatchLockState> {
  const { fechaActual, overriding } = await syncAppNowFromEnv();

  const supabase = await createClient();
  const [{ data: nowData }, { data: roundsData }] = await Promise.all([
    supabase.rpc("app_now"),
    supabase.from("rounds").select("id, predictions_locked_at").eq("tournament_id", tournamentId),
  ]);

  const lockedRoundIds = new Set<string>(
    (roundsData ?? []).filter((r) => r.predictions_locked_at !== null).map((r) => r.id),
  );

  return {
    appNow: (nowData as string | null) ?? new Date().toISOString(),
    fechaActual,
    overriding,
    lockedRoundIds,
  };
}

// True when the round of this fixture has been locked by the admin.
export function isFixtureLocked(roundId: string, lockedRoundIds: Set<string>): boolean {
  return lockedRoundIds.has(roundId);
}
