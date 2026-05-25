import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { Badge } from "@/components/ui/Badge";
import { ROUNDS, type RoundCode } from "@/lib/fixtures/catalogs";
import {
  generateKnockoutPairings,
  generateRandomResults,
  lockRoundPredictions,
  unlockRoundPredictions,
} from "./actions";

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

  const { data: allRounds } = await supabase
    .from("rounds")
    .select("id, code, name, sort_order, predictions_locked_at")
    .eq("tournament_id", tournament.id)
    .order("sort_order", { ascending: true });

  const round = (allRounds ?? []).find((r) => r.code === roundCode) ?? null;

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
          <p className="mt-2 text-sm text-zinc-600">
            Torneo: <strong>{tournament.name}</strong>. {confirmedCount} confirmados · {draftCount}{" "}
            en borrador.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-zinc-600 underline hover:text-zinc-900">
          ← Volver a administración
        </Link>
      </div>

      {params.ok === "draft" && (
        <p className="border-success-light bg-success-light text-success-fg mt-4 rounded-md border p-3 text-sm">
          Borrador guardado.
        </p>
      )}
      {params.ok === "confirmed" && (
        <p className="border-success-light bg-success-light text-success-fg mt-4 rounded-md border p-3 text-sm">
          Resultado confirmado.
        </p>
      )}
      {params.ok === "random" && (
        <p className="border-success-light bg-success-light text-success-fg mt-4 rounded-md border p-3 text-sm">
          Resultados aleatorios generados y confirmados para esta jornada.
        </p>
      )}
      {params.ok === "pairings" && (
        <p className="border-success-light bg-success-light text-success-fg mt-4 rounded-md border p-3 text-sm">
          Cruces generados. Predicciones, resultados y goles previos de esta ronda fueron
          eliminados; el motor de puntuación se ha recalculado.
        </p>
      )}
      {params.ok === "locked" && (
        <p className="border-success-light bg-success-light text-success-fg mt-4 rounded-md border p-3 text-sm">
          Jornada bloqueada. Las predicciones de esa jornada quedan congeladas y son visibles para
          todos los participantes.
        </p>
      )}
      {params.ok === "unlocked" && (
        <p className="border-warning-light bg-warning-light text-warning-fg mt-4 rounded-md border p-3 text-sm">
          Jornada desbloqueada. Los participantes pueden volver a editar sus predicciones y dejan de
          ser visibles para los demás.
        </p>
      )}
      {params.error && (
        <p className="border-danger-light bg-danger-light text-danger-fg mt-4 rounded-md border p-3 text-sm">
          {params.error}
        </p>
      )}

      <section className="mt-6 rounded-md border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Bloqueo de predicciones por jornada</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Mientras una jornada esté abierta, los participantes pueden seguir editando sus
          predicciones de sus partidos y nadie ve las de los demás. Cuando la bloquees, esas
          predicciones quedan congeladas y son visibles para todos los participantes (ya no se
          pueden modificar ni copiar).
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(allRounds ?? []).map((r) => {
            const locked = r.predictions_locked_at !== null;
            return (
              <li
                key={r.id}
                className={
                  "flex items-center justify-between rounded-md border px-3 py-2 text-sm " +
                  (locked
                    ? "border-warning-light bg-warning-light"
                    : "border-success-light bg-success-light")
                }
              >
                <div className="flex flex-col">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-zinc-500">
                    {locked ? `🔒 Bloqueada` : "🟢 Abierta"}
                  </span>
                </div>
                <form action={locked ? unlockRoundPredictions : lockRoundPredictions}>
                  <input type="hidden" name="round" value={r.code} />
                  <button
                    type="submit"
                    className={
                      "rounded-md px-3 py-1 text-xs font-medium " +
                      (locked
                        ? "border-warning text-warning-fg hover:bg-warning-light border bg-white"
                        : "bg-primary text-primary-fg hover:opacity-90")
                    }
                  >
                    {locked ? "Desbloquear" : "Bloquear"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Jornada / ronda</span>
          <select
            name="round"
            defaultValue={roundCode}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
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
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Ver jornada
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-3">
        {isKnockoutRound && (
          <form action={generateKnockoutPairings}>
            <input type="hidden" name="round" value={roundCode} />
            <button
              type="submit"
              className="border-info bg-info-light text-info-fg hover:bg-info-light rounded-md border px-4 py-2 text-sm font-medium"
              title="Empareja al azar los equipos del torneo para esta ronda. Borra predicciones, resultados y goles existentes de esta ronda."
            >
              🎲 Generar cruces (esta ronda)
            </button>
          </form>
        )}
        <form action={generateRandomResults}>
          <input type="hidden" name="round" value={roundCode} />
          <button
            type="submit"
            className="border-warning bg-warning-light text-warning-fg hover:bg-warning-light rounded-md border px-4 py-2 text-sm font-medium"
            title="Genera y confirma resultados al azar para todos los partidos con equipos de esta jornada (ayuda de desarrollo)"
          >
            🎲 Generar resultados aleatorios (esta jornada)
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
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
                <td colSpan={isKnockoutRound ? 6 : 5} className="py-6 text-center text-zinc-500">
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
                  <Badge tone="success">Confirmado</Badge>
                ) : (
                  <Badge tone="warning">Borrador</Badge>
                );

                return (
                  <tr key={f.id} className="border-b border-zinc-100 hover:bg-zinc-50">
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
                          className="text-sm text-zinc-600 underline hover:text-zinc-900"
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
