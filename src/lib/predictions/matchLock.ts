import "server-only";
import { createClient } from "@/lib/supabase/server";
import { syncAppNowFromEnv } from "@/lib/dates/appNow";

// Per-fixture prediction lock (PID §4.4): a fixture is locked once we are
// within 24h of its kickoff. Postgres enforces this via
// public.is_fixture_locked (now compares against public.app_now() — see
// migration 20260517120000), and the RLS on match_predictions uses it.
//
// For a list of fixtures we don't want one rpc per fixture: we fetch the
// DB's "now" once (app_now, real now() or the FECHA_ACTUAL override) and
// reproduce the exact same formula in JS. The comparison instant comes
// from Postgres, not Date.now(), so this stays a single source of truth
// with RLS and sidesteps the Next 16 `react-hooks/purity` rule. We sync
// the env override into app_settings first so the DB and the app agree.

const LOCK_MS = 24 * 60 * 60 * 1000;

export type MatchLockState = {
  /** UTC ISO of the DB's "now" (real now() or FECHA_ACTUAL). */
  appNow: string;
  /** UTC ISO of the simulated now (FECHA_ACTUAL), or null when not set. */
  fechaActual: string | null;
  /** True when the FECHA_ACTUAL override is active. */
  overriding: boolean;
};

export async function getMatchLockState(): Promise<MatchLockState> {
  const { fechaActual, overriding } = await syncAppNowFromEnv();

  const supabase = await createClient();
  const { data } = await supabase.rpc("app_now");

  return {
    appNow: (data as string | null) ?? new Date().toISOString(),
    fechaActual,
    overriding,
  };
}

// Same formula as public.is_fixture_locked: app_now >= kickoff - 24h.
export function isFixtureLocked(kickoffIso: string, appNowIso: string): boolean {
  return new Date(appNowIso).getTime() >= new Date(kickoffIso).getTime() - LOCK_MS;
}
