import { z } from "zod";

// One fixture's prediction, posted from the round form with fields suffixed
// by the fixture id (h90_<id>, a90_<id>, et_<id>, pen_<id>, qual_<id>).
// home_team_id / away_team_id / is_knockout are NOT user input — the server
// injects them from the fixture row so the cross rules below can be checked
// here in one place. We capture the 90' result, whether there is extra time
// / penalties, and which team advances; the 120' score is NOT recorded
// (user decision — see migration 20260517130000).

const NonNegInt = z.coerce
  .number({ message: "Número inválido" })
  .int("Debe ser un entero")
  .min(0, "No puede ser negativo");

const Uuid = z.string().uuid("Selección inválida");

export const FixturePredictionSchema = z
  .object({
    fixture_id: Uuid,
    is_knockout: z.boolean(),
    home_team_id: Uuid,
    away_team_id: Uuid,
    home_goals_90: NonNegInt,
    away_goals_90: NonNegInt,
    predicts_extra_time: z.boolean(),
    predicts_penalties: z.boolean(),
    predicted_qualified_team_id: Uuid.nullable(),
  })
  .superRefine((p, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const draw90 = p.home_goals_90 === p.away_goals_90;

    // DB CHECK still in force: penalties ⇒ extra time.
    if (p.predicts_penalties && !p.predicts_extra_time) {
      add("No puede haber penaltis sin prórroga.");
    }

    // D09-9: group vs knockout coherence.
    if (!p.is_knockout) {
      if (p.predicts_extra_time || p.predicts_penalties) {
        add("En fase de grupos no hay prórroga ni penaltis.");
      }
      if (p.predicted_qualified_team_id != null) {
        add("En fase de grupos no se elige equipo que pasa.");
      }
      return; // nothing else applies to group fixtures
    }

    // Knockout from here on.
    if (p.predicts_extra_time && !draw90) {
      add("Solo se va a la prórroga si el partido está empatado a 90'.");
    }
    if (draw90 && !p.predicts_extra_time) {
      add("En eliminatorias un empate a 90' obliga a prórroga.");
    }
    if (p.predicted_qualified_team_id == null) {
      add("En eliminatorias debes indicar el equipo que pasa.");
      return;
    }
    if (
      p.predicted_qualified_team_id !== p.home_team_id &&
      p.predicted_qualified_team_id !== p.away_team_id
    ) {
      add("El equipo que pasa debe ser uno de los dos del partido.");
      return;
    }

    // Decided in 90' (no extra time): the team that advances must be the
    // 90' winner. With extra time the winner is free (ET/penalties not
    // tracked beyond who advances).
    if (!p.predicts_extra_time) {
      const w =
        p.home_goals_90 > p.away_goals_90
          ? p.home_team_id
          : p.away_goals_90 > p.home_goals_90
            ? p.away_team_id
            : null;
      if (w && p.predicted_qualified_team_id !== w) {
        add("El equipo que pasa no coincide con el ganador a 90'.");
      }
    }
  });

export type FixturePrediction = z.infer<typeof FixturePredictionSchema>;

type FixtureMeta = {
  id: string;
  is_knockout: boolean;
  home_team_id: string;
  away_team_id: string;
};

// "" / absent → null. Returns the raw string or null.
function field(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const value = String(raw).trim();
  return value === "" ? null : value;
}

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) != null;
}

export type ReadFixtureResult =
  | { kind: "skip"; fixtureId: string }
  | { kind: "ok"; data: FixturePrediction }
  | { kind: "error"; fixtureId: string; message: string };

// Parse one fixture from the round form. If the user left both 90' fields
// empty we treat it as "not predicted" and skip it (partial save is OK).
export function readFixturePayload(formData: FormData, f: FixtureMeta): ReadFixtureResult {
  const h90 = field(formData, `h90_${f.id}`);
  const a90 = field(formData, `a90_${f.id}`);
  if (h90 == null && a90 == null) return { kind: "skip", fixtureId: f.id };

  const et = f.is_knockout && checkbox(formData, `et_${f.id}`);
  const pen = f.is_knockout && checkbox(formData, `pen_${f.id}`);

  const parsed = FixturePredictionSchema.safeParse({
    fixture_id: f.id,
    is_knockout: f.is_knockout,
    home_team_id: f.home_team_id,
    away_team_id: f.away_team_id,
    home_goals_90: h90,
    away_goals_90: a90,
    predicts_extra_time: et,
    predicts_penalties: pen,
    predicted_qualified_team_id: f.is_knockout ? field(formData, `qual_${f.id}`) : null,
  });

  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(" ");
    return { kind: "error", fixtureId: f.id, message };
  }
  return { kind: "ok", data: parsed.data };
}
