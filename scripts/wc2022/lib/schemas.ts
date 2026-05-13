import { z } from "zod";

// Seeder-specific schemas (used only by upload.ts). The Python pipeline
// match schema lives in src/lib/fixtures/pythonFormat.ts because it is
// also consumed by the admin import UI (hito 07).

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

export {
  PythonMatchSchema,
  PythonMatchesSchema,
  type PythonMatch,
} from "../../../src/lib/fixtures/pythonFormat";
