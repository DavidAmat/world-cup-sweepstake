import { z } from "zod";

export const GOAL_PERIODS = [
  "first_half",
  "second_half",
  "extra_time_first",
  "extra_time_second",
  "unknown",
] as const;

export type GoalPeriod = (typeof GOAL_PERIODS)[number];

// One scored goal. player_id null = unassigned scorer (players can be
// seeded progressively; the result is still recordable without them).
export const GoalSchema = z.object({
  team_id: z.string().uuid(),
  player_id: z.string().uuid().nullable(),
  minute: z.number().int().min(0).max(130).nullable(),
  period: z.enum(GOAL_PERIODS).nullable(),
  own_goal: z.boolean(),
  penalty_goal: z.boolean(),
});

export type GoalInput = z.infer<typeof GoalSchema>;

// home_team_id / away_team_id / is_knockout are injected by the server from
// the fixture row, never trusted from the client form.
export const MatchResultPayloadSchema = z
  .object({
    fixture_id: z.string().uuid(),
    home_team_id: z.string().uuid(),
    away_team_id: z.string().uuid(),
    is_knockout: z.boolean(),
    home_goals_90: z.number().int().min(0),
    away_goals_90: z.number().int().min(0),
    went_extra_time: z.boolean(),
    home_goals_120: z.number().int().min(0).nullable(),
    away_goals_120: z.number().int().min(0).nullable(),
    went_penalties: z.boolean(),
    penalty_winner_team_id: z.string().uuid().nullable(),
    goals: z.array(GoalSchema),
  })
  .superRefine((d, ctx) => {
    // Mirror match_results_check: went_extra_time ↔ 120' goals present.
    if (d.went_extra_time && (d.home_goals_120 == null || d.away_goals_120 == null)) {
      ctx.addIssue({ code: "custom", message: "Con prórroga debes introducir los goles a 120'." });
    }
    if (!d.went_extra_time && (d.home_goals_120 != null || d.away_goals_120 != null)) {
      ctx.addIssue({ code: "custom", message: "Sin prórroga no puede haber goles a 120'." });
    }
    // Mirror match_results_check1: penalties ⇒ extra time ∧ penalty winner.
    if (d.went_penalties && !d.went_extra_time) {
      ctx.addIssue({ code: "custom", message: "No puede haber penaltis sin prórroga." });
    }
    if (d.went_penalties && d.penalty_winner_team_id == null) {
      ctx.addIssue({
        code: "custom",
        message: "Con penaltis debes indicar el equipo que ganó la tanda.",
      });
    }
    if (!d.went_penalties && d.penalty_winner_team_id != null) {
      ctx.addIssue({
        code: "custom",
        message: "Sin penaltis no puede haber ganador por penaltis.",
      });
    }
    // Penalty winner must be one of the two teams in the fixture.
    if (
      d.penalty_winner_team_id != null &&
      d.penalty_winner_team_id !== d.home_team_id &&
      d.penalty_winner_team_id !== d.away_team_id
    ) {
      ctx.addIssue({
        code: "custom",
        message: "El ganador de penaltis debe ser uno de los dos equipos.",
      });
    }
    // Group games never go to extra time.
    if (!d.is_knockout && (d.went_extra_time || d.went_penalties)) {
      ctx.addIssue({
        code: "custom",
        message: "Un partido de fase de grupos no puede ir a prórroga ni penaltis.",
      });
    }
    // Every goal belongs to one of the two teams.
    for (const g of d.goals) {
      if (g.team_id !== d.home_team_id && g.team_id !== d.away_team_id) {
        ctx.addIssue({
          code: "custom",
          message: "Cada gol debe pertenecer al equipo local o al visitante.",
        });
        break;
      }
    }
  });

export type MatchResultPayload = z.infer<typeof MatchResultPayloadSchema>;

type FixtureMeta = {
  fixture_id: string;
  home_team_id: string;
  away_team_id: string;
  is_knockout: boolean;
};

const numOrNull = (v: FormDataEntryValue | null): number | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

// Parses + validates the FormData posted by ResultForm. Returns either the
// validated payload or a human-readable error message (first issue).
export function readResultPayload(
  formData: FormData,
  meta: FixtureMeta,
): { ok: true; data: MatchResultPayload } | { ok: false; message: string } {
  let goals: unknown;
  try {
    goals = JSON.parse(String(formData.get("goals_json") ?? "[]"));
  } catch {
    return { ok: false, message: "Lista de goles inválida." };
  }

  const raw = {
    fixture_id: meta.fixture_id,
    home_team_id: meta.home_team_id,
    away_team_id: meta.away_team_id,
    is_knockout: meta.is_knockout,
    home_goals_90: numOrNull(formData.get("home_goals_90")),
    away_goals_90: numOrNull(formData.get("away_goals_90")),
    went_extra_time: formData.get("went_extra_time") === "1",
    home_goals_120: meta.is_knockout ? numOrNull(formData.get("home_goals_120")) : null,
    away_goals_120: meta.is_knockout ? numOrNull(formData.get("away_goals_120")) : null,
    went_penalties: formData.get("went_penalties") === "1",
    penalty_winner_team_id: (() => {
      const v = String(formData.get("penalty_winner_team_id") ?? "").trim();
      return v === "" ? null : v;
    })(),
    goals,
  };

  const parsed = MatchResultPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Datos del resultado inválidos." };
  }
  return { ok: true, data: parsed.data };
}
