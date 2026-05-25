"use client";

import { useState } from "react";
import { TeamName } from "@/components/ui/TeamName";
import { NumberInput } from "@/components/ui/NumberInput";
import { saveMatchResult, confirmMatchResult } from "../actions";
import { GOAL_PERIODS, type GoalPeriod } from "../schemas";

export type TeamLite = { id: string; code: string; display_name: string };
export type PlayerLite = { id: string; display_name: string };

export type GoalEntry = {
  team_id: string;
  player_id: string | null;
  minute: number | null;
  period: string | null;
  own_goal: boolean;
  penalty_goal: boolean;
};

type ExistingResult = {
  home_goals_90: number;
  away_goals_90: number;
  went_penalties: boolean;
  qualified_team_id: string | null;
};

type Props = {
  fixtureId: string;
  isKnockout: boolean;
  homeTeam: TeamLite;
  awayTeam: TeamLite;
  homePlayers: PlayerLite[];
  awayPlayers: PlayerLite[];
  existingResult: ExistingResult | null;
  existingGoals: GoalEntry[];
};

const INPUT_CLS = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";
const GOAL_NUM_CLS =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 w-16 text-center font-oswald text-xl font-bold text-zinc-900 focus:border-primary focus:outline-none";

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  first_half: "1ª parte",
  second_half: "2ª parte",
  extra_time_first: "Pró. 1ª",
  extra_time_second: "Pró. 2ª",
  unknown: "Sin especificar",
};

export function ResultForm({
  fixtureId,
  isKnockout,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  existingResult,
  existingGoals,
}: Props) {
  const r = existingResult;
  const [h90, setH90] = useState(r ? String(r.home_goals_90) : "");
  const [a90, setA90] = useState(r ? String(r.away_goals_90) : "");
  const [wentPen, setWentPen] = useState(r?.went_penalties ?? false);
  const [qual, setQual] = useState(r?.qualified_team_id ?? "");
  const [goals, setGoals] = useState<GoalEntry[]>(existingGoals);

  // Extra time and the winner are derived from the 90' score, mirroring the
  // server (deriveResult): a knockout drawn at 90' goes to extra time and the
  // advancing team is an explicit pick (the 120' score is not tracked).
  const bothFilled = h90 !== "" && a90 !== "";
  const drawAt90 = bothFilled && Number(h90) === Number(a90);
  const knockoutDraw = isKnockout && drawAt90;
  const decidedWinner =
    isKnockout && bothFilled && !drawAt90
      ? Number(h90) > Number(a90)
        ? homeTeam
        : awayTeam
      : null;

  const playersFor = (teamId: string) =>
    teamId === homeTeam.id ? homePlayers : teamId === awayTeam.id ? awayPlayers : [];

  const addGoal = () =>
    setGoals((gs) => [
      ...gs,
      {
        team_id: homeTeam.id,
        player_id: null,
        minute: null,
        period: "unknown",
        own_goal: false,
        penalty_goal: false,
      },
    ]);

  const removeGoal = (idx: number) => setGoals((gs) => gs.filter((_, i) => i !== idx));

  const patchGoal = (idx: number, patch: Partial<GoalEntry>) =>
    setGoals((gs) => gs.map((g, i) => (i === idx ? { ...g, ...patch } : g)));

  return (
    <form className="mt-6 space-y-6">
      <input type="hidden" name="fixture_id" value={fixtureId} />
      <input type="hidden" name="goals_json" value={JSON.stringify(goals)} />
      {knockoutDraw && wentPen && <input type="hidden" name="went_penalties" value="1" />}
      {knockoutDraw && <input type="hidden" name="qualified_team_id" value={qual} />}

      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Resultado a 90&apos;</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="min-w-28 font-medium"><TeamName name={homeTeam.display_name} /></span>
          <NumberInput
            name="home_goals_90"
            value={h90}
            onChange={setH90}
            className={GOAL_NUM_CLS}
            required
          />
          <span className="text-zinc-400">–</span>
          <NumberInput
            name="away_goals_90"
            value={a90}
            onChange={setA90}
            className={GOAL_NUM_CLS}
            required
          />
          <span className="min-w-28 font-medium"><TeamName name={awayTeam.display_name} /></span>
        </div>
      </section>

      {isKnockout && (
        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Eliminatoria</h2>

          {!bothFilled && (
            <p className="mt-3 text-sm text-zinc-500">
              Introduce el marcador a 90&apos; para definir la eliminatoria.
            </p>
          )}

          {decidedWinner && (
            <p className="mt-3 text-sm text-zinc-600">
              Resuelto en el tiempo reglamentario. Pasa{" "}
              <strong>{decidedWinner.display_name}</strong>.
            </p>
          )}

          {knockoutDraw && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-zinc-600">
                Empate a 90&apos; → prórroga (automático). No se anota el resultado a 120&apos;.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={wentPen}
                  onChange={(e) => setWentPen(e.target.checked)}
                />
                ¿Fueron a penaltis?
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  Equipo que pasó {wentPen ? "(ganador de penaltis)" : "(ganó en la prórroga)"}
                </span>
                <select
                  value={qual}
                  onChange={(e) => setQual(e.target.value)}
                  className={INPUT_CLS}
                  required
                >
                  <option value="">— Selecciona —</option>
                  <option value={homeTeam.id}>{homeTeam.display_name}</option>
                  <option value={awayTeam.id}>{awayTeam.display_name}</option>
                </select>
              </label>
            </div>
          )}
        </section>
      )}

      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Goles ({goals.length})</h2>
          <button
            type="button"
            onClick={addGoal}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            + Añadir gol
          </button>
        </div>

        {goals.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Sin goles. Puedes guardar el resultado sin registrar goleadores.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {goals.map((g, i) => {
              const players = playersFor(g.team_id);
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-100 p-3"
                >
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Equipo</span>
                    <select
                      value={g.team_id}
                      onChange={(e) => patchGoal(i, { team_id: e.target.value, player_id: null })}
                      className={INPUT_CLS}
                    >
                      <option value={homeTeam.id}>{homeTeam.code}</option>
                      <option value={awayTeam.id}>{awayTeam.code}</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Goleador</span>
                    <select
                      value={g.player_id ?? ""}
                      onChange={(e) => patchGoal(i, { player_id: e.target.value || null })}
                      className={INPUT_CLS}
                    >
                      <option value="">Sin asignar</option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Minuto</span>
                    <NumberInput
                      max={130}
                      value={g.minute === null || g.minute === undefined ? "" : String(g.minute)}
                      onChange={(val) =>
                        patchGoal(i, { minute: val === "" ? null : Number(val) })
                      }
                      className={`${INPUT_CLS} w-20 font-oswald`}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Periodo</span>
                    <select
                      value={g.period ?? "unknown"}
                      onChange={(e) => patchGoal(i, { period: e.target.value })}
                      className={INPUT_CLS}
                    >
                      {GOAL_PERIODS.map((p) => (
                        <option key={p} value={p}>
                          {PERIOD_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={g.own_goal}
                      onChange={(e) => patchGoal(i, { own_goal: e.target.checked })}
                    />
                    En propia
                  </label>

                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={g.penalty_goal}
                      onChange={(e) => patchGoal(i, { penalty_goal: e.target.checked })}
                    />
                    De penalti
                  </label>

                  <button
                    type="button"
                    onClick={() => removeGoal(i)}
                    className="border-danger-light text-danger-fg hover:bg-danger-light ml-auto rounded-md border px-2 py-1 text-xs font-medium"
                  >
                    ✕ Quitar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          formAction={saveMatchResult}
          className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100"
        >
          Guardar borrador
        </button>
        <button
          type="submit"
          formAction={confirmMatchResult}
          className="bg-success-light hover:bg-success-light rounded-md px-5 py-2.5 text-sm font-medium text-white"
        >
          Confirmar y recalcular
        </button>
      </div>
    </form>
  );
}
