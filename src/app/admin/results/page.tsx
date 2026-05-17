import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { Badge } from "@/components/ui/Badge";
import { ROUNDS, type RoundCode } from "@/lib/fixtures/catalogs";
import { generateRandomResults } from "./actions";

type SearchParams = Promise<{ round?: string; ok?: string; error?: string }>;

type FixtureRow = {
  id: string;
  kickoff_at: string;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_team: { id: string; display_name: string } | null;
  away_team: { id: string; display_name: string } | null;
  round: { code: string; name: string } | null;
};

type ResultRow = {
  fixture_id: string;
  result_status: string;
  home_goals_90: number;
  away_goals_90: number;
  went_extra_time: boolean;
  went_penalties: boolean;
  qualified_team_id: string | null;
};

const DEFAULT_ROUND: RoundCode = "group_md1";

export default async function AdminResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();
  const params = await searchParams;

  const roundCode = (ROUNDS.find((r) => r.code === params.round)?.code ??
    DEFAULT_ROUND) as RoundCode;

  const { data: round } = await supabase
    .from("rounds")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("code", roundCode)
    .maybeSingle();

  let fixtures: FixtureRow[] = [];
  if (round) {
    const { data } = await supabase
      .from("fixtures")
      .select(
        `
          id,
          kickoff_at,
          home_placeholder,
          away_placeholder,
          home_team:teams!fixtures_home_team_id_fkey ( id, display_name ),
          away_team:teams!fixtures_away_team_id_fkey ( id, display_name ),
          round:rounds ( code, name )
        `,
      )
      .eq("tournament_id", tournament.id)
      .eq("round_id", round.id)
      .order("kickoff_at", { ascending: true });
    fixtures = (data ?? []) as unknown as FixtureRow[];
  }

  const { data: resultsData } = await supabase
    .from("match_results")
    .select(
      "fixture_id, result_status, home_goals_90, away_goals_90, went_extra_time, went_penalties, qualified_team_id",
    )
    .eq("tournament_id", tournament.id);
  const resultByFixture = new Map<string, ResultRow>();
  for (const r of (resultsData ?? []) as ResultRow[]) resultByFixture.set(r.fixture_id, r);

  const confirmedCount = (resultsData ?? []).filter((r) => r.result_status === "confirmed").length;
  const draftCount = (resultsData ?? []).filter((r) => r.result_status === "draft").length;

  const isKnockoutRound = ROUNDS.find((r) => r.code === roundCode)?.stage_code !== "group_stage";

  return (
    <main className="mx-auto max-w-5xl p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Resultados</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Torneo: <strong>{tournament.name}</strong>. {confirmedCount} confirmados · {draftCount}{" "}
            en borrador.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Volver a administración
        </Link>
      </div>

      {params.ok === "draft" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Borrador guardado.
        </p>
      )}
      {params.ok === "confirmed" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Resultado confirmado.
        </p>
      )}
      {params.ok === "random" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Resultados aleatorios generados y confirmados para esta jornada.
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {params.error}
        </p>
      )}

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Jornada / ronda</span>
          <select
            name="round"
            defaultValue={roundCode}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {ROUNDS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Ver jornada
        </button>
      </form>

      <form action={generateRandomResults} className="mt-4">
        <input type="hidden" name="round" value={roundCode} />
        <button
          type="submit"
          className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
          title="Genera y confirma resultados al azar para todos los partidos con equipos de esta jornada (ayuda de desarrollo)"
        >
          🎲 Generar resultados aleatorios (esta jornada)
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:border-zinc-800">
              <th className="py-2 pr-3">Partido</th>
              <th className="py-2 pr-3">Fecha (Madrid)</th>
              <th className="py-2 pr-3">Marcador</th>
              {isKnockoutRound && <th className="py-2 pr-3">Pasa</th>}
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {fixtures.length === 0 ? (
              <tr>
                <td
                  colSpan={isKnockoutRound ? 6 : 5}
                  className="py-6 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No hay partidos en esta jornada.
                </td>
              </tr>
            ) : (
              fixtures.map((f) => {
                const home = f.home_team?.display_name ?? f.home_placeholder ?? "—";
                const away = f.away_team?.display_name ?? f.away_placeholder ?? "—";
                const hasTeams = f.home_team != null && f.away_team != null;
                const result = resultByFixture.get(f.id);

                let scoreLabel = "—";
                if (result) {
                  scoreLabel = `${result.home_goals_90}-${result.away_goals_90}`;
                  if (result.went_extra_time) scoreLabel += " (pró.)";
                  if (result.went_penalties) scoreLabel += " (pen.)";
                }

                const statusBadge = !result ? (
                  <Badge tone="zinc">Sin resultado</Badge>
                ) : result.result_status === "confirmed" ? (
                  <Badge tone="emerald">Confirmado</Badge>
                ) : (
                  <Badge tone="amber">Borrador</Badge>
                );

                return (
                  <tr
                    key={f.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/40"
                  >
                    <td className="py-2 pr-3">
                      {home} <span className="text-zinc-400">vs</span> {away}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatMadridDateTime(f.kickoff_at)}
                    </td>
                    <td className="py-2 pr-3 font-mono">{scoreLabel}</td>
                    {isKnockoutRound && (
                      <td className="py-2 pr-3">
                        {result?.qualified_team_id ? (
                          ((result.qualified_team_id === f.home_team?.id
                            ? f.home_team?.display_name
                            : f.away_team?.display_name) ?? "—")
                        ) : result ? (
                          <span className="text-xs text-zinc-400 italic">Sin asignar</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                    <td className="py-2 pr-3">{statusBadge}</td>
                    <td className="py-2 pr-3">
                      {hasTeams ? (
                        <Link
                          href={`/admin/results/${f.id}`}
                          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                        >
                          {result ? "Ver / editar" : "Introducir"}
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Sin equipos</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        Mostrando {fixtures.length} partido(s) de la jornada seleccionada. Las fechas se muestran en
        horario Madrid (CET/CEST).
      </p>
    </main>
  );
}
