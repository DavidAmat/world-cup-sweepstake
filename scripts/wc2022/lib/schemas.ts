import { z } from "zod";

export const TournamentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string(),
  year: z.number().int(),
  status: z.enum(["draft", "active", "completed", "archived"]),
  is_test: z.boolean(),
  predictions_open_until: z.string().datetime().nullable(),
  group_qualifiers_per_group: z.number().int().min(1).max(4),
});
export type TournamentInput = z.infer<typeof TournamentSchema>;

export const TeamSchema = z.object({
  external_id: z.string(),
  code: z.string().length(3),
  canonical_name: z.string(),
  display_name: z.string(),
  aliases: z.array(z.string()),
  group_code: z.string().regex(/^[A-H]$/),
});
export const TeamsSchema = z.array(TeamSchema).length(32);
export type TeamInput = z.infer<typeof TeamSchema>;

// Schema for the Python pipeline JSON (after stripping results).
// Shape matches data/partidos/2022/partidos_2022_sin_resultados.json.
export const PythonMatchSchema = z.object({
  external_id: z.string(),
  fase: z.enum([
    "fase_grupos",
    "octavos",
    "cuartos",
    "semis",
    "tercer_puesto",
    "final",
  ]),
  tipo_partido: z.enum(["grupo", "eliminatoria"]),
  jornada: z.number().int().nullable(),
  grupo: z.string().regex(/^[A-H]$/).nullable(),
  equipo_1: z.string(),
  equipo_2: z.string(),
  fecha: z.string(),
  marcador_equipo_1_90_mins: z.number().int().nullable(),
  marcador_equipo_2_90_mins: z.number().int().nullable(),
  prorroga: z.boolean().nullable(),
  penaltis: z.boolean().nullable(),
  ganador: z.string().nullable(),
});
export const PythonMatchesSchema = z.array(PythonMatchSchema);
export type PythonMatch = z.infer<typeof PythonMatchSchema>;
