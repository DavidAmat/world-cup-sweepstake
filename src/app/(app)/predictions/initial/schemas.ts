import { z } from "zod";

// The 8 groups of the tournament. `group_qualifiers_per_group` is 2 for
// wc_2022_test: per group the user picks EXACTLY 2 teams (order does not
// matter — predicted_position is stored as null). If a future tournament
// changes the count, GROUP_QUALIFIERS + the form grid is what grows.
export const GROUP_CODES = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type GroupCode = (typeof GROUP_CODES)[number];

export const GROUP_QUALIFIERS = 2;

const UuidOrNull = z.string().uuid("Selección inválida").nullable();
const FreeTextOrNull = z.string().trim().min(1).max(80, "Máximo 80 caracteres").nullable();

// Per group the form posts 0..N checkbox values under the same name
// (`qual_<G>`). We validate the "exactly 2" rule in the server action so
// the error message can name the offending group in Spanish.
const QualifierSchema = z.object({
  group_code: z.enum(GROUP_CODES),
  team_ids: z.array(z.string().uuid("Selección inválida")),
});

export const InitialPredictionPayloadSchema = z.object({
  champion_team_id: UuidOrNull,
  runner_up_team_id: UuidOrNull,
  top_scorer_text: FreeTextOrNull,
  best_player_text: FreeTextOrNull,
  qualifiers: z.array(QualifierSchema).length(GROUP_CODES.length),
});

export type InitialPredictionPayload = z.infer<typeof InitialPredictionPayloadSchema>;

// FormData arrives as strings; "" means "not chosen" → null. Same pattern
// as src/app/admin/fixtures/schemas.ts (kept local to the hito).
function field(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const value = String(raw).trim();
  return value === "" ? null : value;
}

export function readInitialPayload(formData: FormData): InitialPredictionPayload {
  return InitialPredictionPayloadSchema.parse({
    champion_team_id: field(formData, "champion_team_id"),
    runner_up_team_id: field(formData, "runner_up_team_id"),
    top_scorer_text: field(formData, "top_scorer_text"),
    best_player_text: field(formData, "best_player_text"),
    qualifiers: GROUP_CODES.map((g) => ({
      group_code: g,
      team_ids: formData
        .getAll(`qual_${g}`)
        .map((v) => String(v).trim())
        .filter((v) => v !== ""),
    })),
  });
}
