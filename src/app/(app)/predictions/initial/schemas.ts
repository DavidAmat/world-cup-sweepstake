import { z } from "zod";

// 12 groups for wc_2026. Per group the user picks the teams they think advance
// to R32 (order does not matter — `predicted_position` is stored as null).
// WC2026 sends the top 2 of every group PLUS the 8 best third-placed teams to
// R32. So the user marks 3 teams in exactly BEST_THIRDS_ADVANCE (8) groups (the
// 2 firsts + the third they bet sneaks in as a best third) and 2 in the other
// 4 groups → 32 advancing teams total. The best-thirds ranking lives in the
// scoring engine (src/lib/scoring/scoreGroup.ts).
export const GROUP_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
export type GroupCode = (typeof GROUP_CODES)[number];

export const MIN_QUALIFIERS = 2;
export const MAX_QUALIFIERS = 3;

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
