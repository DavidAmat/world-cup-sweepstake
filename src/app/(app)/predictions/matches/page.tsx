import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { getMatchLockState, isFixtureLocked } from "@/lib/predictions/matchLock";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { generateRandomMatchPredictions } from "./actions";
import { MatchesForm, type RoundVM } from "./MatchesForm";
import type { LockedEntry } from "./LockedFixturePanel";
import { maxPointsForStage } from "@/lib/scoring/maxPoints";
import type { StageCode } from "@/lib/scoring/types";

type SearchParams = Promise<{ error?: string; ok?: string }>;

type TeamRef = { display_name: string; code: string } | null;
type Fixture = {
  id: string;
  kickoff_at: string;
  round_id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team: TeamRef;
  away_team: TeamRef;
  stage: { code: string } | null;
};

type RawPrediction = {
  user_id: string;
  fixture_id: string;
  home_goals_90: number;
  away_goals_90: number;
  predicts_extra_time: boolean;
  predicts_penalties: boolean;
  predicted_qualified_team_id: string | null;
};

type RawScore = {
  user_id: string;
  fixture_id: string | null;
  points_total: number | string;
  points_breakdown: Record<string, unknown> | null;
};

type RawResult = {
  fixture_id: string;
  home_goals_90: number | null;
  away_goals_90: number | null;
  went_extra_time: boolean | null;
  went_penalties: boolean | null;
  qualified_team_id: string | null;
};

export default async function MatchPredictionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, ok } = await searchParams;
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();
  const { overriding, fechaActual, lockedRoundIds } = await getMatchLockState(tournament.id);

  const [
    { data: rounds },
    { data: fxData },
    { data: allPredsRaw },
    { data: allScoresRaw },
    { data: resultsRaw },
    { data: profilesRaw },
  ] = await Promise.all([
    supabase
      .from("rounds")
      .select("id, code, name, sort_order")
      .eq("tournament_id", tournament.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("fixtures")
      .select(
        `id, kickoff_at, round_id, home_team_id, away_team_id,
         home_team:teams!fixtures_home_team_id_fkey ( display_name, code ),
         away_team:teams!fixtures_away_team_id_fkey ( display_name, code ),
         stage:stages ( code )`,
      )
      .eq("tournament_id", tournament.id)
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("match_predictions")
      .select(
        "user_id, fixture_id, home_goals_90, away_goals_90, predicts_extra_time, predicts_penalties, predicted_qualified_team_id",
      )
      .eq("tournament_id", tournament.id),
    supabase
      .from("prediction_scores")
      .select("user_id, fixture_id, points_total, points_breakdown")
      .eq("tournament_id", tournament.id)
      .in("prediction_type", ["group_phase", "knockout"]),
    supabase
      .from("match_results")
      .select(
        "fixture_id, home_goals_90, away_goals_90, went_extra_time, went_penalties, qualified_team_id",
      )
      .eq("tournament_id", tournament.id)
      .eq("result_status", "confirmed"),
    supabase.from("profiles").select("user_id, display_name, initials").order("display_name"),
  ]);

  const fixtures = (fxData ?? []) as unknown as Fixture[];
  const allPreds = (allPredsRaw ?? []) as RawPrediction[];
  const allScores = ((allScoresRaw ?? []) as RawScore[]).map((s) => ({
    user_id: s.user_id,
    fixture_id: s.fixture_id,
    points: Number(s.points_total),
    breakdown: (s.points_breakdown ?? {}) as Record<string, unknown>,
  }));
  const results = ((resultsRaw ?? []) as RawResult[]).filter((r) => r.fixture_id);

  // Maps for fast lookup at fixture render time
  const myPredByFixture = new Map(
    allPreds.filter((p) => p.user_id === userId).map((p) => [p.fixture_id, p]),
  );
  const myScoreByFixture = new Map(
    allScores
      .filter((s) => s.user_id === userId && s.fixture_id)
      .map((s) => [s.fixture_id as string, { points: s.points, breakdown: s.breakdown }]),
  );

  const predsByFixtureUser = new Map<string, Map<string, RawPrediction>>();
  for (const p of allPreds) {
    if (!predsByFixtureUser.has(p.fixture_id)) predsByFixtureUser.set(p.fixture_id, new Map());
    predsByFixtureUser.get(p.fixture_id)!.set(p.user_id, p);
  }
  const scoresByFixtureUser = new Map<
    string,
    Map<string, { points: number; breakdown: Record<string, unknown> }>
  >();
  for (const s of allScores) {
    if (!s.fixture_id) continue;
    if (!scoresByFixtureUser.has(s.fixture_id)) scoresByFixtureUser.set(s.fixture_id, new Map());
    scoresByFixtureUser
      .get(s.fixture_id)!
      .set(s.user_id, { points: s.points, breakdown: s.breakdown });
  }

  const resultByFixture = new Map(
    results.map((r) => [
      r.fixture_id,
      {
        h: r.home_goals_90 ?? 0,
        a: r.away_goals_90 ?? 0,
        et: r.went_extra_time ?? false,
        pen: r.went_penalties ?? false,
        qualifiedTeamId: r.qualified_team_id,
      },
    ]),
  );

  const profiles = profilesRaw ?? [];
  const myProfile = profiles.find((p) => p.user_id === userId);
  const myDisplayName = myProfile?.display_name ?? "Yo";
  const otherProfiles = profiles.filter((p) => p.user_id !== userId);

  const fixturesByRound = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const arr = fixturesByRound.get(f.round_id) ?? [];
    arr.push(f);
    fixturesByRound.set(f.round_id, arr);
  }

  const roundVMs: RoundVM[] = (rounds ?? [])
    .filter((r) => (fixturesByRound.get(r.id)?.length ?? 0) > 0)
    .map((r) => ({
      code: r.code,
      name: r.name,
      fixtures: (fixturesByRound.get(r.id) ?? []).map((f) => {
        const myP = myPredByFixture.get(f.id);
        const myScore = myScoreByFixture.get(f.id) ?? null;

        const otherEntries: LockedEntry[] = otherProfiles
          .map((prof) => {
            const op = predsByFixtureUser.get(f.id)?.get(prof.user_id) ?? null;
            const os = scoresByFixtureUser.get(f.id)?.get(prof.user_id) ?? null;
            return {
              user_id: prof.user_id,
              display_name: prof.display_name,
              prediction: op
                ? {
                    h90: op.home_goals_90,
                    a90: op.away_goals_90,
                    et: op.predicts_extra_time,
                    pen: op.predicts_penalties,
                    qual: op.predicted_qualified_team_id,
                  }
                : null,
              score: os,
            };
          })
          .sort(
            (a, b) =>
              (b.score?.points ?? -1) - (a.score?.points ?? -1) ||
              a.display_name.localeCompare(b.display_name),
          );

        const stageCode = (f.stage?.code ?? "group_stage") as StageCode;
        return {
          id: f.id,
          home: f.home_team?.display_name ?? f.home_team?.code ?? "—",
          away: f.away_team?.display_name ?? f.away_team?.code ?? "—",
          homeId: f.home_team_id ?? "",
          awayId: f.away_team_id ?? "",
          kickoff: f.kickoff_at,
          isKnockout: stageCode !== "group_stage",
          locked: isFixtureLocked(f.round_id, lockedRoundIds),
          noTeams: !f.home_team_id || !f.away_team_id,
          maxPoints: maxPointsForStage(stageCode),
          saved: myP
            ? {
                h90: myP.home_goals_90,
                a90: myP.away_goals_90,
                et: myP.predicts_extra_time,
                pen: myP.predicts_penalties,
                qual: myP.predicted_qualified_team_id,
              }
            : null,
          score: myScore,
          realResult: resultByFixture.get(f.id) ?? null,
          otherEntries,
        };
      }),
    }));

  return (
    <main className="mx-auto max-w-4xl p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Predicciones de partidos</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Marcador a 90&apos;. En eliminatorias, además prórroga, penaltis y equipo que pasa. El
            administrador bloquea cada jornada antes de su primer partido; una vez bloqueada, no se
            pueden editar y las predicciones de todos se hacen públicas.
          </p>
        </div>
        <Link href="/predictions/matches/public" className="text-sm whitespace-nowrap underline">
          Vista pública
        </Link>
      </div>

      {overriding && (
        <p className="mt-4 rounded-md border border-sky-300 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          🧪 Fecha simulada (FECHA_ACTUAL):{" "}
          <strong>{fechaActual ? formatMadridDateTime(fechaActual) : "—"} (Madrid)</strong>.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {ok === "saved" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Predicciones guardadas.
        </p>
      )}
      {ok === "random" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Predicciones aleatorias generadas para todos tus partidos abiertos.
        </p>
      )}

      <form action={generateRandomMatchPredictions} className="mt-4">
        <button
          type="submit"
          className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
          title="Rellena al azar todos tus partidos no bloqueados"
        >
          🎲 Generar predicciones aleatorias
        </button>
      </form>

      {roundVMs.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Todavía no hay partidos cargados para este torneo.
        </p>
      ) : (
        <MatchesForm rounds={roundVMs} myDisplayName={myDisplayName} />
      )}
    </main>
  );
}
