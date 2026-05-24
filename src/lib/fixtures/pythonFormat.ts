import { z } from "zod";
import type { RoundCode, StageCode } from "./catalogs";

// Shared format between the Python pipeline (hito 06 seeds) and the
// admin import UI (hito 07). One shape, one schema, two consumers.

export const FASE_VALUES = [
  "fase_grupos",
  "dieciseisavos",
  "octavos",
  "cuartos",
  "semis",
  "tercer_puesto",
  "final",
] as const;

export type Fase = (typeof FASE_VALUES)[number];

export const PythonMatchSchema = z.object({
  external_id: z.string().regex(/^[a-z0-9_-]+$/, "external_id must be snake_case"),
  fase: z.enum(FASE_VALUES),
  tipo_partido: z.enum(["grupo", "eliminatoria"]).nullable(),
  jornada: z.number().int().nullable(),
  grupo: z
    .string()
    .regex(/^[A-L]$/)
    .nullable(),
  // For knockout fixtures without assigned teams, use the literal "TBD"
  // as equipo_1 / equipo_2. The seeder upserts those as
  // home_placeholder / away_placeholder with home_team_id null.
  equipo_1: z.string().trim().min(1),
  equipo_2: z.string().trim().min(1),
  fecha: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/,
      "fecha must be YYYY-MM-DDTHH:MM(:SS) Madrid local",
    ),
  venue: z.string().nullable().optional(),
  // Result fields exist in the Python output; the UI ignores them but
  // accepting them keeps the script + UI on the exact same schema.
  marcador_equipo_1_90_mins: z.number().int().nullable().optional(),
  marcador_equipo_2_90_mins: z.number().int().nullable().optional(),
  prorroga: z.boolean().nullable().optional(),
  penaltis: z.boolean().nullable().optional(),
  ganador: z.string().nullable().optional(),
});

export const PythonMatchesSchema = z.array(PythonMatchSchema);

// Strict size cap for the UI import path — defends against pasting a
// huge file by mistake. The seeder accepts any length via the broader
// PythonMatchesSchema, so its idempotent re-runs are unaffected.
export const ImportFixturesSchema = z.array(PythonMatchSchema).min(1).max(64);

export type PythonMatch = z.infer<typeof PythonMatchSchema>;

const FASE_TO_STAGE: Record<Fase, StageCode> = {
  fase_grupos: "group_stage",
  dieciseisavos: "round_of_32",
  octavos: "round_of_16",
  cuartos: "quarter_final",
  semis: "semi_final",
  tercer_puesto: "third_place",
  final: "final",
};

const STAGE_TO_FASE: Record<StageCode, Fase> = {
  group_stage: "fase_grupos",
  round_of_32: "dieciseisavos",
  round_of_16: "octavos",
  quarter_final: "cuartos",
  semi_final: "semis",
  third_place: "tercer_puesto",
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
  if (fase === "dieciseisavos") return "r32";
  if (fase === "octavos") return "r16";
  if (fase === "cuartos") return "qf";
  if (fase === "semis") return "sf";
  if (fase === "tercer_puesto") return "third";
  if (fase === "final") return "final";
  throw new Error(`Unknown fase: ${fase as string}`);
}

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
