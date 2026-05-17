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

// The 120' score is NOT captured (user decision, hito 10 — mirrors hito 09).
// A result captures: 90' score, whether it went to penalties, and which team
// advanced (free pick when the 90' is a draw in a knockout). Extra time and
// the official winner are DERIVED, never trusted from the form.
//
// home_team_id / away_team_id / is_knockout are injected by the server from
// the fixture row.
export const MatchResultPayloadSchema = z
  .object({
    fixture_id: z.string().uuid(),
    home_team_id: z.string().uuid(),
    away_team_id: z.string().uuid(),
    is_knockout: z.boolean(),
    home_goals_90: z.number().int().min(0),
    away_goals_90: z.number().int().min(0),
    went_penalties: z.boolean(),
    // The advancing team. Required only for a knockout drawn at 90'; otherwise
    // it is derived from the 90' winner (knockout) or irrelevant (group).
    qualified_team_id: z.string().uuid().nullable(),
    goals: z.array(GoalSchema),
  })
  .superRefine((d, ctx) => {
    const drawAt90 = d.home_goals_90 === d.away_goals_90;
    const knockoutDraw = d.is_knockout && drawAt90;

    // Penalties only make sense for a knockout drawn at 90' (⇒ extra time).
    if (d.went_penalties && !knockoutDraw) {
      ctx.addIssue({
        code: "custom",
        message: "Solo puede haber penaltis en una eliminatoria empatada a 90'.",
      });
    }
    // A knockout drawn at 90' must declare which team advanced.
    if (knockoutDraw) {
      if (d.qualified_team_id == null) {
        ctx.addIssue({
          code: "custom",
          message: "Empate a 90' en eliminatoria: indica qué equipo pasó.",
        });
      } else if (d.qualified_team_id !== d.home_team_id && d.qualified_team_id !== d.away_team_id) {
        ctx.addIssue({
          code: "custom",
          message: "El equipo que pasa debe ser uno de los dos equipos.",
        });
      }
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

// Persistable columns of match_results. The 120' columns are kept in the
// schema (nullable) but always written as NULL from now on.
export type DerivedResult = {
  home_goals_90: number;
  away_goals_90: number;
  went_extra_time: boolean;
  home_goals_120: null;
  away_goals_120: null;
  went_penalties: boolean;
  penalty_winner_team_id: string | null;
  winner_team_id: string | null;
  qualified_team_id: string | null;
};

// Single source of truth for turning a validated payload into DB columns.
// Reused by the form action and the random generator.
export function deriveResult(d: MatchResultPayload): DerivedResult {
  const drawAt90 = d.home_goals_90 === d.away_goals_90;
  const ninetyWinner = d.home_goals_90 > d.away_goals_90 ? d.home_team_id : d.away_team_id;

  if (d.is_knockout && drawAt90) {
    // Draw at 90' ⇒ extra time. The advancing team is the explicit pick
    // (we do not track the 120' score). Penalties optional.
    const advance = d.qualified_team_id;
    return {
      home_goals_90: d.home_goals_90,
      away_goals_90: d.away_goals_90,
      went_extra_time: true,
      home_goals_120: null,
      away_goals_120: null,
      went_penalties: d.went_penalties,
      penalty_winner_team_id: d.went_penalties ? advance : null,
      winner_team_id: advance,
      qualified_team_id: advance,
    };
  }

  if (d.is_knockout) {
    // Decided in 90' (knockouts never end level outside a draw).
    return {
      home_goals_90: d.home_goals_90,
      away_goals_90: d.away_goals_90,
      went_extra_time: false,
      home_goals_120: null,
      away_goals_120: null,
      went_penalties: false,
      penalty_winner_team_id: null,
      winner_team_id: ninetyWinner,
      qualified_team_id: ninetyWinner,
    };
  }

  // Group game: only the 90' score; winner is null on a draw, no qualifier.
  return {
    home_goals_90: d.home_goals_90,
    away_goals_90: d.away_goals_90,
    went_extra_time: false,
    home_goals_120: null,
    away_goals_120: null,
    went_penalties: false,
    penalty_winner_team_id: null,
    winner_team_id: drawAt90 ? null : ninetyWinner,
    qualified_team_id: null,
  };
}

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

  const qual = String(formData.get("qualified_team_id") ?? "").trim();

  const raw = {
    fixture_id: meta.fixture_id,
    home_team_id: meta.home_team_id,
    away_team_id: meta.away_team_id,
    is_knockout: meta.is_knockout,
    home_goals_90: numOrNull(formData.get("home_goals_90")),
    away_goals_90: numOrNull(formData.get("away_goals_90")),
    went_penalties: formData.get("went_penalties") === "1",
    qualified_team_id: qual === "" ? null : qual,
    goals,
  };

  const parsed = MatchResultPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Datos del resultado inválidos." };
  }
  return { ok: true, data: parsed.data };
}
