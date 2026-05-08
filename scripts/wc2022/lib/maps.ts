import type { RoundCode, StageCode } from "./catalogs";

// Maps the Spanish "fase" / "jornada" used in the Python pipeline to
// the (stage_code, round_code) pair used in the SQL schema.

export type Fase =
  | "fase_grupos"
  | "octavos"
  | "cuartos"
  | "semis"
  | "tercer_puesto"
  | "final";

const FASE_TO_STAGE: Record<Fase, StageCode> = {
  fase_grupos: "group_stage",
  octavos: "round_of_16",
  cuartos: "quarter_final",
  semis: "semi_final",
  tercer_puesto: "third_place",
  final: "final",
};

export function resolveStage(fase: Fase): StageCode {
  const stage = FASE_TO_STAGE[fase];
  if (!stage) throw new Error(`Unknown fase: ${fase}`);
  return stage;
}

export function resolveRound(fase: Fase, jornada: number | null): RoundCode {
  if (fase === "fase_grupos") {
    if (jornada === 1) return "group_md1";
    if (jornada === 2) return "group_md2";
    if (jornada === 3) return "group_md3";
    throw new Error(`group match without valid jornada: ${jornada}`);
  }
  if (fase === "octavos") return "r16";
  if (fase === "cuartos") return "qf";
  if (fase === "semis") return "sf";
  if (fase === "tercer_puesto") return "third";
  if (fase === "final") return "final";
  throw new Error(`Unknown fase: ${fase as string}`);
}

// Madrid local "YYYY-MM-DD HH:MM:SS" → UTC ISO 8601.
//
// We assume Europe/Madrid local time. For matches scheduled in
// June-July (Mundial 2026 testing window) Madrid is in CEST (UTC+2),
// so we use the explicit `+02:00` offset. The function still works
// for any datetime since `new Date(...)` parses the offset literally.
//
// LIMITATION: dates outside CEST (winter months) would need `+01:00`.
// Not a concern for the 2022 test seeded into 2026, but to be revisited
// for the real 2026 calendar if it includes any non-CEST date (e.g. a
// final played in late October).
export function madridLocalToUtcIso(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(fecha)) {
    throw new Error(`Unexpected fecha format: ${fecha}`);
  }
  const iso = fecha.replace(" ", "T") + "+02:00";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Unparseable fecha: ${fecha}`);
  }
  return d.toISOString();
}
