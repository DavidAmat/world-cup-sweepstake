import { z } from "zod";

// The 8 groups of the tournament. `group_qualifiers_per_group` is 2 for
// wc_2022_test, so per group we capture the predicted 1st and 2nd. If a
// future tournament changes the count this constant + the form grid is
// what grows; the storage model (one gqp row per qualifier with
// predicted_position) already supports N.
export const GROUP_CODES = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type GroupCode = (typeof GROUP_CODES)[number];

const UuidOrNull = z.string().uuid("Selección inválida").nullable();
const FreeTextOrNull = z.string().trim().min(1).max(80, "Máximo 80 caracteres").nullable();

const QualifierSchema = z.object({
  group_code: z.enum(GROUP_CODES),
  pos1_team_id: UuidOrNull,
  pos2_team_id: UuidOrNull,
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
      pos1_team_id: field(formData, `qual_${g}_pos1`),
      pos2_team_id: field(formData, `qual_${g}_pos2`),
    })),
  });
}
