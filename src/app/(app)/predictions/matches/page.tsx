import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { getMatchLockState, isFixtureLocked } from "@/lib/predictions/matchLock";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { generateRandomMatchPredictions } from "./actions";
import { MatchesForm, type RoundVM } from "./MatchesForm";

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

export default async function MatchPredictionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, ok } = await searchParams;
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();
  const { appNow, overriding, fechaActual } = await getMatchLockState();

  const [{ data: rounds }, { data: fxData }, { data: preds }, { data: scoresRaw }] =
    await Promise.all([
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
          "fixture_id, home_goals_90, away_goals_90, predicts_extra_time, predicts_penalties, predicted_qualified_team_id",
        )
        .eq("tournament_id", tournament.id)
        .eq("user_id", userId),
      supabase
        .from("prediction_scores")
        .select("fixture_id, points_total, points_breakdown")
        .eq("tournament_id", tournament.id)
        .eq("user_id", userId)
        .in("prediction_type", ["group_phase", "knockout"]),
    ]);

  const fixtures = (fxData ?? []) as unknown as Fixture[];
  const predByFixture = new Map((preds ?? []).map((p) => [p.fixture_id, p]));
  const scoreByFixture = new Map(
    (scoresRaw ?? [])
      .filter((s) => s.fixture_id)
      .map((s) => [
        s.fixture_id as string,
        {
          points: Number(s.points_total),
          breakdown: (s.points_breakdown ?? {}) as Record<string, unknown>,
        },
      ]),
  );

  // Rounds already come ordered group → r16 → qf → sf → third → final
  // (sort_order), so the final is always last. Keep only rounds that have
  // at least one fixture.
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
        const p = predByFixture.get(f.id);
        return {
          id: f.id,
          home: f.home_team?.display_name ?? f.home_team?.code ?? "—",
          away: f.away_team?.display_name ?? f.away_team?.code ?? "—",
          homeId: f.home_team_id ?? "",
          awayId: f.away_team_id ?? "",
          kickoff: f.kickoff_at,
          isKnockout: (f.stage?.code ?? "group_stage") !== "group_stage",
          locked: isFixtureLocked(f.kickoff_at, appNow),
          noTeams: !f.home_team_id || !f.away_team_id,
          saved: p
            ? {
                h90: p.home_goals_90,
                a90: p.away_goals_90,
                et: p.predicts_extra_time,
                pen: p.predicts_penalties,
                qual: p.predicted_qualified_team_id,
              }
            : null,
          score: scoreByFixture.get(f.id) ?? null,
        };
      }),
    }));

  return (
    <main className="mx-auto max-w-4xl p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Predicciones de partidos</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Marcador a 90&apos;. En eliminatorias, además prórroga, penaltis y equipo que pasa. Cada
            partido se bloquea 24&nbsp;h antes del inicio.
          </p>
        </div>
        <Link href="/predictions/matches/public" className="text-sm whitespace-nowrap underline">
          Vista pública
        </Link>
      </div>

      {overriding && (
        <p className="mt-4 rounded-md border border-sky-300 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          🧪 Fecha simulada (FECHA_ACTUAL):{" "}
          <strong>{fechaActual ? formatMadridDateTime(fechaActual) : "—"} (Madrid)</strong>. El
          bloqueo de cada partido se evalúa contra esta fecha.
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
        <MatchesForm rounds={roundVMs} />
      )}
    </main>
  );
}
