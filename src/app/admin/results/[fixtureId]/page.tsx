import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { Badge } from "@/components/ui/Badge";
import { ResultForm, type GoalEntry, type TeamLite, type PlayerLite } from "./ResultForm";

type RouteParams = Promise<{ fixtureId: string }>;
type SearchParams = Promise<{ error?: string; ok?: string; edit?: string }>;

type FixtureRow = {
  id: string;
  kickoff_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team: TeamLite | null;
  away_team: TeamLite | null;
  stage: { code: string; name: string } | null;
  round: { name: string } | null;
};

type ResultRow = {
  result_status: string;
  home_goals_90: number;
  away_goals_90: number;
  went_extra_time: boolean;
  home_goals_120: number | null;
  away_goals_120: number | null;
  went_penalties: boolean;
  penalty_winner_team_id: string | null;
  winner_team_id: string | null;
  qualified_team_id: string | null;
};

type GoalRow = {
  team_id: string;
  player_id: string | null;
  minute: number | null;
  period: string | null;
  own_goal: boolean;
  penalty_goal: boolean;
};

export default async function ResultEntryPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const { fixtureId } = await params;
  const { error: errMsg, ok, edit } = await searchParams;
  const { supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();

  const { data: fixture, error } = await supabase
    .from("fixtures")
    .select(
      `
        id,
        kickoff_at,
        home_team_id,
        away_team_id,
        home_team:teams!fixtures_home_team_id_fkey ( id, code, display_name ),
        away_team:teams!fixtures_away_team_id_fkey ( id, code, display_name ),
        stage:stages ( code, name ),
        round:rounds ( name )
      `,
    )
    .eq("id", fixtureId)
    .eq("tournament_id", tournament.id)
    .maybeSingle<FixtureRow>();

  if (error) throw new Error(`Failed to load fixture: ${error.message}`);
  if (!fixture) notFound();

  const hasTeams =
    fixture.home_team_id != null &&
    fixture.away_team_id != null &&
    fixture.home_team != null &&
    fixture.away_team != null;

  const isKnockout = (fixture.stage?.code ?? "group_stage") !== "group_stage";

  const matchupTitle = hasTeams
    ? `${fixture.home_team!.display_name} vs ${fixture.away_team!.display_name}`
    : "Partido sin equipos asignados";

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{matchupTitle}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {fixture.round?.name} · {fixture.stage?.name} · {formatMadridDateTime(fixture.kickoff_at)}{" "}
          (Madrid)
        </p>
      </div>
      <Link
        href="/admin/results"
        className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Volver al listado
      </Link>
    </div>
  );

  if (!hasTeams) {
    return (
      <main className="mx-auto max-w-3xl p-10">
        {header}
        <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Este partido todavía no tiene los dos equipos asignados. Asígnalos en{" "}
          <Link href="/admin/fixtures" className="underline">
            Fixtures
          </Link>{" "}
          antes de introducir el resultado.
        </p>
      </main>
    );
  }

  const homeTeam = fixture.home_team!;
  const awayTeam = fixture.away_team!;

  const { data: result } = await supabase
    .from("match_results")
    .select(
      `result_status, home_goals_90, away_goals_90, went_extra_time, home_goals_120,
       away_goals_120, went_penalties, penalty_winner_team_id, winner_team_id, qualified_team_id`,
    )
    .eq("fixture_id", fixtureId)
    .maybeSingle<ResultRow>();

  const { data: goalsData } = await supabase
    .from("match_goals")
    .select("team_id, player_id, minute, period, own_goal, penalty_goal")
    .eq("fixture_id", fixtureId)
    .order("minute", { ascending: true, nullsFirst: false });
  const existingGoals: GoalEntry[] = ((goalsData ?? []) as GoalRow[]).map((g) => ({
    team_id: g.team_id,
    player_id: g.player_id,
    minute: g.minute,
    period: g.period,
    own_goal: g.own_goal,
    penalty_goal: g.penalty_goal,
  }));

  const { data: playersData } = await supabase
    .from("players")
    .select("id, display_name, team_id")
    .eq("tournament_id", tournament.id)
    .eq("active", true)
    .in("team_id", [homeTeam.id, awayTeam.id])
    .order("display_name", { ascending: true });
  const homePlayers: PlayerLite[] = (playersData ?? [])
    .filter((p) => p.team_id === homeTeam.id)
    .map((p) => ({ id: p.id, display_name: p.display_name }));
  const awayPlayers: PlayerLite[] = (playersData ?? [])
    .filter((p) => p.team_id === awayTeam.id)
    .map((p) => ({ id: p.id, display_name: p.display_name }));

  const isConfirmed = result?.result_status === "confirmed";
  const readOnly = isConfirmed && edit !== "1";

  const banners = (
    <>
      {ok === "draft" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Borrador guardado.
        </p>
      )}
      {ok === "confirmed" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Resultado confirmado. El recálculo de puntuaciones se hará en el hito 11.
        </p>
      )}
      {errMsg && (
        <p className="mt-4 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {errMsg}
        </p>
      )}
    </>
  );

  if (readOnly && result) {
    const teamName = (id: string | null) =>
      id === homeTeam.id ? homeTeam.display_name : id === awayTeam.id ? awayTeam.display_name : "—";
    const goalLabel = (g: GoalEntry) => {
      const team = g.team_id === homeTeam.id ? homeTeam.code : awayTeam.code;
      const players = g.team_id === homeTeam.id ? homePlayers : awayPlayers;
      const scorer = g.player_id
        ? (players.find((p) => p.id === g.player_id)?.display_name ?? "Jugador")
        : "Sin asignar";
      const flags = [g.own_goal ? "p.p." : null, g.penalty_goal ? "pen." : null]
        .filter(Boolean)
        .join(" · ");
      const min = g.minute != null ? `${g.minute}'` : "—";
      return `${min} · ${team} · ${scorer}${flags ? ` (${flags})` : ""}`;
    };

    return (
      <main className="mx-auto max-w-3xl p-10">
        {header}
        {banners}
        <div className="mt-6 flex items-center gap-3">
          <Badge tone="emerald">Confirmado</Badge>
          <Link
            href={`/admin/results/${fixtureId}?edit=1`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Editar resultado
          </Link>
        </div>

        <section className="mt-6 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Marcador</h2>
          <p className="mt-2 font-mono text-lg">
            {homeTeam.display_name} {result.home_goals_90} – {result.away_goals_90}{" "}
            {awayTeam.display_name}
          </p>
          {result.went_extra_time && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Hubo prórroga
              {result.went_penalties && (
                <> · Penaltis: ganó {teamName(result.penalty_winner_team_id)}</>
              )}
            </p>
          )}
          {isKnockout && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Equipo que pasa: <strong>{teamName(result.qualified_team_id)}</strong>
            </p>
          )}
        </section>

        <section className="mt-4 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Goles ({existingGoals.length})</h2>
          {existingGoals.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No se han registrado goles.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {existingGoals.map((g, i) => (
                <li key={i} className="font-mono">
                  {goalLabel(g)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-10">
      {header}
      {banners}
      {isConfirmed && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Estás editando un resultado ya confirmado. Al guardar volverá a borrador; al confirmar se
          recalculará.
        </p>
      )}
      <ResultForm
        fixtureId={fixture.id}
        isKnockout={isKnockout}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homePlayers={homePlayers}
        awayPlayers={awayPlayers}
        existingResult={
          result
            ? {
                home_goals_90: result.home_goals_90,
                away_goals_90: result.away_goals_90,
                went_penalties: result.went_penalties,
                qualified_team_id: result.qualified_team_id,
              }
            : null
        }
        existingGoals={existingGoals}
      />
    </main>
  );
}
