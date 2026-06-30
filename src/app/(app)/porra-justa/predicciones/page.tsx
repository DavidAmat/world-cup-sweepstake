import Link from "next/link";
import { Scale, Flag } from "lucide-react";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { TeamName } from "@/components/ui/TeamName";
import { BreakdownTable } from "@/components/scoring/BreakdownTable";
import { BreakdownPopover } from "@/components/scoring/BreakdownPopover";
import { PointsBar } from "@/components/scoring/PointsBar";
import { maxPointsForFixture } from "@/lib/scoring/maxPoints";
import type { StageCode } from "@/lib/scoring/types";
import { PorraJustaTabs } from "../Tabs";

const KNOCKOUT_STAGES = new Set<StageCode>([
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
]);

type FixtureRow = {
  id: string;
  kickoff_at: string | null;
  group_code: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  stage: { code: string } | null;
  round: { code: string; name: string; sort_order: number } | null;
  home_team: { display_name: string } | null;
  away_team: { display_name: string } | null;
};

export default async function PrediccionesJustasPage() {
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();

  const [fixturesRes, fairRes, realRes, myPredsRes, myScoresRes] = await Promise.all([
    supabase
      .from("fixtures")
      .select(
        `id, kickoff_at, group_code, home_team_id, away_team_id,
         stage:stages ( code ),
         round:rounds ( code, name, sort_order ),
         home_team:teams!fixtures_home_team_id_fkey ( display_name ),
         away_team:teams!fixtures_away_team_id_fkey ( display_name )`,
      )
      .eq("tournament_id", tournament.id),
    supabase
      .from("fair_match_results")
      .select(
        "fixture_id, home_goals_90, away_goals_90, went_extra_time, went_penalties, qualified_team_id",
      )
      .eq("tournament_id", tournament.id),
    supabase
      .from("match_results")
      .select("fixture_id, home_goals_90, away_goals_90, qualified_team_id")
      .eq("tournament_id", tournament.id)
      .eq("result_status", "confirmed"),
    supabase
      .from("match_predictions")
      .select(
        "fixture_id, home_goals_90, away_goals_90, predicts_extra_time, predicts_penalties, predicted_qualified_team_id",
      )
      .eq("tournament_id", tournament.id)
      .eq("user_id", userId),
    supabase
      .from("fair_prediction_scores")
      .select("fixture_id, points_total, points_breakdown")
      .eq("tournament_id", tournament.id)
      .eq("user_id", userId),
  ]);

  const fixtures = (fixturesRes.data ?? []) as FixtureRow[];
  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));
  const fairByFixture = new Map((fairRes.data ?? []).map((r) => [r.fixture_id, r]));
  const realByFixture = new Map((realRes.data ?? []).map((r) => [r.fixture_id, r]));
  const myPredByFixture = new Map((myPredsRes.data ?? []).map((p) => [p.fixture_id, p]));
  const myScoreByFixture = new Map(
    (myScoresRes.data ?? []).map((s) => [
      s.fixture_id,
      {
        points: Number(s.points_total),
        breakdown: (s.points_breakdown ?? {}) as Record<string, unknown>,
      },
    ]),
  );

  // Group the fixtures that have a Resultado Justo by jornada (round).
  const roundsMap = new Map<
    string,
    { code: string; name: string; sort_order: number; fixtures: FixtureRow[] }
  >();
  for (const fr of fairRes.data ?? []) {
    const fx = fixtureById.get(fr.fixture_id);
    if (!fx || !fx.round) continue;
    let group = roundsMap.get(fx.round.code);
    if (!group) {
      group = { ...fx.round, fixtures: [] };
      roundsMap.set(fx.round.code, group);
    }
    group.fixtures.push(fx);
  }
  const roundGroups = [...roundsMap.values()].sort((a, b) => a.sort_order - b.sort_order);
  for (const g of roundGroups) {
    g.fixtures.sort((a, b) => (a.kickoff_at ?? "").localeCompare(b.kickoff_at ?? ""));
  }

  const teamName = (fx: FixtureRow, id: string | null | undefined): string => {
    if (!id) return "—";
    if (id === fx.home_team_id) return fx.home_team?.display_name ?? "—";
    if (id === fx.away_team_id) return fx.away_team?.display_name ?? "—";
    return "—";
  };

  return (
    <main className="mx-auto max-w-5xl p-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Scale className="text-special h-6 w-6" aria-hidden />
          Predicciones Partidos Justos
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Solo lectura. Para cada partido se muestra el resultado real y, debajo, el{" "}
          <strong>Resultado Justo</strong> (descontando los goles del minuto 90 en adelante). Los
          puntos se calculan tratando el Resultado Justo como el resultado real.
        </p>
      </div>

      <PorraJustaTabs active="predicciones" />

      {roundGroups.length === 0 ? (
        <p className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Todavía no hay partidos con Resultado Justo.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {roundGroups.map((g) => (
            <section key={g.code}>
              <h2 className="text-lg font-bold text-zinc-800">{g.name}</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {g.fixtures.map((fx) => {
                  const fair = fairByFixture.get(fx.id)!;
                  const real = realByFixture.get(fx.id) ?? null;
                  const stageCode = (fx.stage?.code ?? "group_stage") as StageCode;
                  const isKnockout = KNOCKOUT_STAGES.has(stageCode);
                  const myPred = myPredByFixture.get(fx.id) ?? null;
                  const myScore = myScoreByFixture.get(fx.id) ?? null;
                  const maxPts = maxPointsForFixture(stageCode, {
                    went_extra_time: fair.went_extra_time,
                    went_penalties: fair.went_penalties,
                  });
                  const pts = myScore?.points ?? 0;
                  const home = fx.home_team?.display_name ?? "—";
                  const away = fx.away_team?.display_name ?? "—";

                  return (
                    <div
                      key={fx.id}
                      className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                    >
                      {/* Real result (small) */}
                      <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-2">
                        <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
                          <Flag className="mr-1 inline h-3 w-3" aria-hidden />
                          Resultado real
                        </p>
                        {real ? (
                          <p className="font-oswald mt-0.5 inline-flex flex-wrap items-center gap-1.5 text-sm text-zinc-600">
                            <TeamName name={home} /> {real.home_goals_90} – {real.away_goals_90}{" "}
                            <TeamName name={away} />
                            {isKnockout && real.qualified_team_id && (
                              <span className="text-xs text-zinc-500">
                                · pasó {teamName(fx, real.qualified_team_id)}
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-sm text-zinc-500 italic">Sin resultado real</p>
                        )}
                      </div>

                      {/* Resultado Justo (highlighted, bigger) */}
                      <div className="border-special/30 bg-special-light/20 border-b px-3 py-2.5">
                        <p className="text-special-fg text-[10px] font-semibold tracking-wide uppercase">
                          <Scale className="mr-1 inline h-3 w-3" aria-hidden />
                          Resultado Justo
                        </p>
                        <p className="font-oswald mt-0.5 inline-flex flex-wrap items-center gap-2 text-xl font-bold text-zinc-900">
                          <TeamName name={home} /> {fair.home_goals_90} – {fair.away_goals_90}{" "}
                          <TeamName name={away} />
                        </p>
                        {isKnockout && (
                          <p className="mt-1 text-xs text-zinc-600">
                            {fair.went_extra_time
                              ? fair.went_penalties
                                ? "Penaltis"
                                : "Prórroga"
                              : "Resuelto en 90′"}{" "}
                            · pasa <strong>{teamName(fx, fair.qualified_team_id)}</strong>
                          </p>
                        )}
                      </div>

                      {/* My fair prediction + points */}
                      <div className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-zinc-700">
                            {myPred ? (
                              <>
                                Tu predicción: <strong>{myPred.home_goals_90}</strong>-
                                <strong>{myPred.away_goals_90}</strong>
                                {isKnockout && (
                                  <>
                                    {" · "}
                                    {myPred.predicts_extra_time ? "prórroga" : "sin pró."}
                                    {" · pasa "}
                                    <TeamName name={teamName(fx, myPred.predicted_qualified_team_id)} />
                                  </>
                                )}
                              </>
                            ) : (
                              <span className="text-zinc-500 italic">No enviaste predicción</span>
                            )}
                          </p>
                          {myScore ? (
                            <BreakdownPopover pointsTotal={pts} label="Ver tu desglose justo">
                              <BreakdownTable breakdown={myScore.breakdown} pointsTotal={pts} />
                            </BreakdownPopover>
                          ) : (
                            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                              0 pts
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <PointsBar value={pts} max={maxPts} />
                        </div>
                        <Link
                          href={`/porra-justa/predicciones/${fx.id}`}
                          className="text-primary mt-2 inline-block text-xs font-medium underline"
                        >
                          Ver ranking del partido →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
