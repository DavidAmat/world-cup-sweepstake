import { z } from "zod";

export const FIXTURE_STATUS_VALUES = ["scheduled", "locked", "completed", "cancelled"] as const;

export const FixtureStatusSchema = z.enum(FIXTURE_STATUS_VALUES);
export type FixtureStatus = z.infer<typeof FixtureStatusSchema>;

const KickoffSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
    "Fecha/hora inválida (esperado YYYY-MM-DDTHH:MM, hora Madrid)",
  );

const SidePayloadSchema = z
  .object({
    team_id: z.string().uuid().nullable(),
    placeholder: z.string().trim().min(1).max(60).nullable(),
  })
  .refine((v) => v.team_id !== null || v.placeholder !== null, {
    message: "Hay que elegir un equipo o escribir un placeholder",
  });

export const UpdateFixturePayloadSchema = z.object({
  id: z.string().uuid(),
  kickoff_at: KickoffSchema,
  home: SidePayloadSchema,
  away: SidePayloadSchema,
  venue: z.string().trim().max(120).nullable(),
  status: FixtureStatusSchema,
});

export const CreateFixturePayloadSchema = z.object({
  external_id: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9_-]+$/, "external_id solo admite minúsculas, dígitos, '_' y '-'"),
  stage_id: z.string().uuid(),
  round_id: z.string().uuid(),
  group_code: z
    .string()
    .trim()
    .regex(/^[A-L]$/)
    .nullable(),
  home: SidePayloadSchema,
  away: SidePayloadSchema,
  kickoff_at: KickoffSchema,
  venue: z.string().trim().max(120).nullable(),
  status: FixtureStatusSchema.default("scheduled"),
});

export type UpdateFixturePayload = z.infer<typeof UpdateFixturePayloadSchema>;
export type CreateFixturePayload = z.infer<typeof CreateFixturePayloadSchema>;

// Helpers to coerce FormData (everything arrives as string) into the
// shapes the schemas expect. Keep them local to this hito — they are
// not general-purpose enough to live in src/lib.

function field(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const value = String(raw).trim();
  return value === "" ? null : value;
}

function readSide(formData: FormData, prefix: "home" | "away") {
  const teamId = field(formData, `${prefix}_team_id`);
  const placeholder = field(formData, `${prefix}_placeholder`);
  return {
    // Prefer team_id when both are present so the row stays coherent
    // with the schema's `team OR placeholder` constraint.
    team_id: teamId,
    placeholder: teamId ? null : placeholder,
  };
}

export function readUpdatePayload(formData: FormData) {
  return UpdateFixturePayloadSchema.parse({
    id: field(formData, "id"),
    kickoff_at: field(formData, "kickoff_at"),
    home: readSide(formData, "home"),
    away: readSide(formData, "away"),
    venue: field(formData, "venue"),
    status: field(formData, "status"),
  });
}

export function readCreatePayload(formData: FormData) {
  return CreateFixturePayloadSchema.parse({
    external_id: field(formData, "external_id"),
    stage_id: field(formData, "stage_id"),
    round_id: field(formData, "round_id"),
    group_code: field(formData, "group_code"),
    home: readSide(formData, "home"),
    away: readSide(formData, "away"),
    kickoff_at: field(formData, "kickoff_at"),
    venue: field(formData, "venue"),
    status: field(formData, "status") ?? "scheduled",
  });
}
