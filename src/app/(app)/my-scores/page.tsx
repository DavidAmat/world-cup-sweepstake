import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { BreakdownTable } from "@/components/scoring/BreakdownTable";
import { BreakdownPopover } from "@/components/scoring/BreakdownPopover";
import { PointsBar } from "@/components/scoring/PointsBar";
import { maxPointsForFixture } from "@/lib/scoring/maxPoints";
import {
  bucketFromBreakdown,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type CategoryBucket,
} from "@/lib/scoring/breakdownLabels";
import type { StageCode } from "@/lib/scoring/types";

const CATEGORY_ORDER: CategoryBucket[] = [
  "match_outcome",
  "knockout_extra",
  "initial",
  "group_qualification",
];

export default async function MyScoresPage() {
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();

  const [{ data: profile }, { data: scoresRaw }, { data: fixtures }, { data: results }] =
    await Promise.all([
      supabase.from("profiles").select("display_name, initials").eq("user_id", userId).single(),
      supabase
        .from("prediction_scores")
        .select("fixture_id, prediction_type, points_total, points_breakdown")
        .eq("tournament_id", tournament.id)
        .eq("user_id", userId),
      supabase
        .from("fixtures")
        .select(
          `id, kickoff_at, stage_id, round_id,
           stage:stages ( code, sort_order ),
           round:rounds ( code, name, sort_order ),
           home_team:teams!fixtures_home_team_id_fkey ( display_name, code ),
           away_team:teams!fixtures_away_team_id_fkey ( display_name, code )`,
        )
        .eq("tournament_id", tournament.id),
      supabase
        .from("match_results")
        .select(
          "fixture_id, home_goals_90, away_goals_90, went_extra_time, went_penalties, result_status",
        )
        .eq("tournament_id", tournament.id)
        .eq("result_status", "confirmed"),
    ]);

  const scores = (scoresRaw ?? []).map((s) => ({
    fixture_id: s.fixture_id as string | null,
    prediction_type: s.prediction_type as
      | "group_phase"
      | "knockout"
      | "initial"
      | "group_qualification",
    points_total: Number(s.points_total),
    points_breakdown: (s.points_breakdown ?? {}) as Record<string, unknown>,
  }));

  const fixtureById = new Map(
    (fixtures ?? []).map((f) => {
      const x = f as unknown as {
        id: string;
        kickoff_at: string;
        stage: { code: string; sort_order: number } | null;
        round: { code: string; name: string; sort_order: number } | null;
        home_team: { display_name: string; code: string } | null;
        away_team: { display_name: string; code: string } | null;
      };
      return [x.id, x];
    }),
  );
  const resultByFixture = new Map(
    (results ?? []).map((r) => [
      r.fixture_id as string,
      {
        h: r.home_goals_90 ?? 0,
        a: r.away_goals_90 ?? 0,
        went_extra_time: r.went_extra_time ?? false,
        went_penalties: r.went_penalties ?? false,
      },
    ]),
  );

  // Aggregate categories + grand total
  const totals: Record<CategoryBucket, number> = {
    match_outcome: 0,
    knockout_extra: 0,
    initial: 0,
    group_qualification: 0,
  };
  let grandTotal = 0;
  for (const s of scores) {
    grandTotal += s.points_total;
    const b = bucketFromBreakdown(s.points_breakdown);
    totals.match_outcome += b.match_outcome;
    totals.knockout_extra += b.knockout_extra;
    totals.initial += b.initial;
    totals.group_qualification += b.group_qualification;
  }

  // Match rows (only fixtures with both prediction_score AND a fixture)
  const matchScores = scores
    .filter(
      (s) =>
        (s.prediction_type === "group_phase" || s.prediction_type === "knockout") &&
        s.fixture_id !== null,
    )
    .map((s) => {
      const fx = fixtureById.get(s.fixture_id!);
      if (!fx) return null;
      const stageCode = (fx.stage?.code ?? "group_stage") as StageCode;
      const result = resultByFixture.get(s.fixture_id!) ?? null;
      return {
        fixture_id: s.fixture_id!,
        stageCode,
        roundName: fx.round?.name ?? "—",
        roundSort: fx.round?.sort_order ?? 0,
        kickoff: fx.kickoff_at,
        homeTeam: fx.home_team?.display_name ?? "TBD",
        awayTeam: fx.away_team?.display_name ?? "TBD",
        result,
        points: s.points_total,
        breakdown: s.points_breakdown,
        max: maxPointsForFixture(
          stageCode,
          result
            ? { went_extra_time: result.went_extra_time, went_penalties: result.went_penalties }
            : null,
        ),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  matchScores.sort((a, b) => a.roundSort - b.roundSort || a.kickoff.localeCompare(b.kickoff));

  return (
    <main className="mx-auto max-w-4xl p-10">
      <h1 className="text-2xl font-bold">Mi puntuación</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {profile?.display_name ?? "Tu"} desglose personal en el torneo. Cada partido confirmado
        aparece como una barra; pulsa <strong>ⓘ</strong> para ver el detalle por criterio.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="border-success-light bg-success-light rounded-md border p-4">
          <p className="text-success-fg text-xs font-semibold uppercase">Total</p>
          <p className="text-success-fg mt-1 font-mono text-3xl font-bold">{grandTotal}</p>
        </div>
        {CATEGORY_ORDER.map((cat) => (
          <div
            key={cat}
            className="rounded-md border border-zinc-200 bg-white p-4"
            title={CATEGORY_DESCRIPTIONS[cat]}
          >
            <p className="text-xs font-semibold text-zinc-500 uppercase">{CATEGORY_LABELS[cat]}</p>
            <p className="mt-1 font-mono text-2xl font-bold">{totals[cat]}</p>
          </div>
        ))}
      </section>

      <h2 className="mt-8 text-lg font-bold">Por partido</h2>
      {matchScores.length === 0 ? (
        <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Aún no hay partidos con resultado confirmado para mostrar.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {matchScores.map((m) => (
            <li key={m.fixture_id} className="rounded-md border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <Link
                    href={`/clasificacion/partido/${m.fixture_id}`}
                    className="font-semibold hover:underline"
                  >
                    {m.homeTeam} {m.result && <span className="font-mono">{m.result.h}</span>}
                    {" - "}
                    {m.result && <span className="font-mono">{m.result.a}</span>} {m.awayTeam}
                  </Link>
                  <span className="ml-2 text-xs text-zinc-500">
                    {m.roundName} · {formatMadridDateTime(m.kickoff)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">
                    {m.points} / {m.max}
                  </span>
                  <BreakdownPopover pointsTotal={m.points}>
                    <BreakdownTable breakdown={m.breakdown} pointsTotal={m.points} />
                  </BreakdownPopover>
                </div>
              </div>
              <div className="mt-3">
                <PointsBar value={m.points} max={m.max} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-zinc-500">
        La barra muestra cuántos puntos sacaste respecto al máximo posible del partido (15 en
        grupos, 66 en eliminatorias hasta cuartos, 99 en semis, 165 en la final).
      </p>
    </main>
  );
}
