import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { ClasificacionTabs } from "../../Tabs";

type RouteParams = Promise<{ roundCode: string }>;

type ScoreRow = {
  user_id: string;
  fixture_id: string | null;
  points_total: number;
};

export default async function JornadaDetallePage({ params }: { params: RouteParams }) {
  const { roundCode } = await params;
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();

  const { data: round } = await supabase
    .from("rounds")
    .select("id, code, name, sort_order")
    .eq("tournament_id", tournament.id)
    .eq("code", roundCode)
    .single();
  if (!round) notFound();

  const [{ data: fxData }, { data: scoresRaw }, { data: profiles }, { data: resultsRaw }] =
    await Promise.all([
      supabase
        .from("fixtures")
        .select(
          `id, kickoff_at, home_team_id, away_team_id,
           home_team:teams!fixtures_home_team_id_fkey ( display_name, code ),
           away_team:teams!fixtures_away_team_id_fkey ( display_name, code )`,
        )
        .eq("tournament_id", tournament.id)
        .eq("round_id", round.id)
        .order("kickoff_at", { ascending: true }),
      supabase
        .from("prediction_scores")
        .select("user_id, fixture_id, points_total")
        .eq("tournament_id", tournament.id)
        .in("prediction_type", ["group_phase", "knockout"]),
      supabase.from("profiles").select("user_id, display_name, initials").order("display_name"),
      supabase
        .from("match_results")
        .select("fixture_id, home_goals_90, away_goals_90, result_status")
        .eq("tournament_id", tournament.id)
        .eq("result_status", "confirmed"),
    ]);

  const fixtures = (fxData ?? []) as unknown as Array<{
    id: string;
    kickoff_at: string;
    home_team_id: string | null;
    away_team_id: string | null;
    home_team: { display_name: string; code: string } | null;
    away_team: { display_name: string; code: string } | null;
  }>;
  const fixtureIds = new Set(fixtures.map((f) => f.id));

  const scores = (
    (scoresRaw ?? []) as Array<{
      user_id: string;
      fixture_id: string | null;
      points_total: number | string;
    }>
  )
    .filter((s) => s.fixture_id && fixtureIds.has(s.fixture_id))
    .map<ScoreRow>((s) => ({
      user_id: s.user_id,
      fixture_id: s.fixture_id,
      points_total: Number(s.points_total),
    }));

  const resultByFixture = new Map(
    (resultsRaw ?? []).map((r) => [
      r.fixture_id as string,
      { h: r.home_goals_90 ?? 0, a: r.away_goals_90 ?? 0 },
    ]),
  );

  // user_id → fixture_id → points
  const pointsByUserFixture = new Map<string, Map<string, number>>();
  const totalByUser = new Map<string, number>();
  for (const s of scores) {
    if (!s.fixture_id) continue;
    if (!pointsByUserFixture.has(s.user_id)) pointsByUserFixture.set(s.user_id, new Map());
    pointsByUserFixture.get(s.user_id)!.set(s.fixture_id, s.points_total);
    totalByUser.set(s.user_id, (totalByUser.get(s.user_id) ?? 0) + s.points_total);
  }

  const sortedProfiles = [...(profiles ?? [])].sort(
    (a, b) => (totalByUser.get(b.user_id) ?? 0) - (totalByUser.get(a.user_id) ?? 0),
  );

  return (
    <main className="mx-auto max-w-5xl p-10">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-500 uppercase">Clasificación · jornada</p>
          <h1 className="text-2xl font-bold">{round.name}</h1>
        </div>
        <Link href="/clasificacion/jornada" className="text-sm underline">
          ← Volver
        </Link>
      </div>

      <ClasificacionTabs active="jornada" />

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase">
            <tr>
              <th className="sticky left-0 bg-zinc-50 px-3 py-2 font-semibold">Partido</th>
              {sortedProfiles.map((p) => (
                <th key={p.user_id} className="px-3 py-2 text-center font-semibold">
                  {p.initials || p.display_name.slice(0, 2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fixtures.map((f) => {
              const result = resultByFixture.get(f.id);
              return (
                <tr key={f.id} className="border-t border-zinc-100">
                  <td className="sticky left-0 bg-white px-3 py-2">
                    <div className="flex flex-col">
                      <Link
                        href={`/clasificacion/partido/${f.id}`}
                        className="font-medium hover:underline"
                      >
                        {f.home_team?.display_name ?? "TBD"} vs {f.away_team?.display_name ?? "TBD"}
                      </Link>
                      <span className="text-xs text-zinc-500">
                        {formatMadridDateTime(f.kickoff_at)}
                        {result ? ` · ${result.h}-${result.a}` : " · sin resultado"}
                      </span>
                    </div>
                  </td>
                  {sortedProfiles.map((p) => {
                    const pts = pointsByUserFixture.get(p.user_id)?.get(f.id);
                    const isMe = p.user_id === userId;
                    return (
                      <td
                        key={p.user_id}
                        className={
                          "px-3 py-2 text-center font-mono " + (isMe ? "bg-info-light" : "")
                        }
                      >
                        {pts === undefined ? <span className="text-zinc-400">—</span> : pts}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-t-2 border-zinc-300 bg-zinc-50">
              <td className="sticky left-0 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500 uppercase">
                Total jornada
              </td>
              {sortedProfiles.map((p) => {
                let s = 0;
                for (const f of fixtures) {
                  s += pointsByUserFixture.get(p.user_id)?.get(f.id) ?? 0;
                }
                return (
                  <td key={p.user_id} className="px-3 py-2 text-center font-mono font-bold">
                    {s}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Pulsa un partido para ver el desglose detallado y comparar las predicciones de cada
        participante.
      </p>
    </main>
  );
}
