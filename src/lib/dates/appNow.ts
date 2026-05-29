import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { madridLocalToUtcIso } from "@/lib/dates/madridTime";

// Optional testing knob: FECHA_ACTUAL overrides public.app_settings.fecha_actual
// so app_now() matches a chosen instant. Prediction locking is admin-controlled
// and does not depend on this value.
//   · unset / empty           → use the real now() (no override)
//   · "YYYY-MM-DD"            → that day 00:00 Madrid time
//   · "YYYY-MM-DDTHH:MM[:SS]" → that wall-clock Madrid time
//   · any ISO with Z/offset   → used as-is
// Returns a UTC ISO string, or null for "no override".
export function parseFechaActual(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (value === "") return null;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return madridLocalToUtcIso(`${value}T00:00:00`);
    }
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      return madridLocalToUtcIso(value);
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      console.warn(`FECHA_ACTUAL no parseable: "${value}" — se ignora (se usa now() real).`);
      return null;
    }
    return d.toISOString();
  } catch (e) {
    console.warn(`FECHA_ACTUAL inválida: "${value}" (${(e as Error).message}) — se ignora.`);
    return null;
  }
}

export type AppNowState = {
  /** UTC ISO of the simulated now, or null when not overriding. */
  fechaActual: string | null;
  /** True when FECHA_ACTUAL is active. */
  overriding: boolean;
};

// Keep public.app_settings.fecha_actual in sync with the env var so the DB
// (RLS + lock functions) and the app agree on "now". Service-role client,
// so it bypasses RLS. Only writes when the value actually changes. Never
// throws — a sync failure must not break the page.
export async function syncAppNowFromEnv(): Promise<AppNowState> {
  const desired = parseFechaActual(process.env.FECHA_ACTUAL);
  try {
    const admin = createAdminClient();
    const { data: current } = await admin
      .from("app_settings")
      .select("fecha_actual")
      .eq("id", true)
      .maybeSingle();

    const currentIso = current?.fecha_actual ? new Date(current.fecha_actual).toISOString() : null;

    if (currentIso !== desired) {
      await admin.from("app_settings").update({ fecha_actual: desired }).eq("id", true);
    }
  } catch (e) {
    console.warn(`No se pudo sincronizar app_settings.fecha_actual: ${(e as Error).message}`);
  }

  return { fechaActual: desired, overriding: desired !== null };
}
