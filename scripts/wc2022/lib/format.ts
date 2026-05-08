import type { RoundCode, StageCode } from "./catalogs";
import type { Fase } from "./maps";

const STAGE_TO_FASE: Record<StageCode, Fase> = {
  group_stage: "fase_grupos",
  round_of_16: "octavos",
  quarter_final: "cuartos",
  semi_final: "semis",
  third_place: "tercer_puesto",
  final: "final",
};

export function stageToFase(stage: StageCode): Fase {
  const f = STAGE_TO_FASE[stage];
  if (!f) throw new Error(`Unknown stage code: ${stage}`);
  return f;
}

export function roundToJornada(round: RoundCode): number | null {
  if (round === "group_md1") return 1;
  if (round === "group_md2") return 2;
  if (round === "group_md3") return 3;
  return null;
}

export function tipoPartidoFromFase(fase: Fase): "grupo" | "eliminatoria" {
  return fase === "fase_grupos" ? "grupo" : "eliminatoria";
}

// Inverse of madridLocalToUtcIso. Takes a UTC ISO string from Postgres
// (e.g. `2026-06-11T16:00:00+00:00`) and renders it as the Madrid-local
// `YYYY-MM-DD HH:MM:SS` shape used by the Python pipeline. Uses
// Intl.DateTimeFormat so it stays correct across CET/CEST without
// manual offset bookkeeping.
export function utcIsoToMadridLocal(utcIso: string): string {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unparseable UTC ISO: ${utcIso}`);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")}`;
}
