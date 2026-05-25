import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { TeamName } from "@/components/ui/TeamName";
import { BreakdownTable } from "@/components/scoring/BreakdownTable";
import { BreakdownPopover } from "@/components/scoring/BreakdownPopover";
import { PointsBar } from "@/components/scoring/PointsBar";
import { maxPointsForFixture } from "@/lib/scoring/maxPoints";
import { ClasificacionTabs } from "@/app/(app)/clasificacion/Tabs";
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

// 4-col grid: label | home goal | dash | away goal. Two of these stacked
// vertically (Real on top, Tú below) give the visually aligned comparison
// the user asked for, mirroring the LockedFixturePanel pattern in
// /predictions/matches.
const SCORE_ROW_CLS =
  "grid grid-cols-[3rem_minmax(1.75rem,auto)_0.5rem_minmax(1.75rem,auto)] items-center gap-1.5 px-3 py-1.5";

type CellTone = "neutral" | "exact" | "close";

// Tones mirror the scoring rule for `home_goals_distance` / `away_goals_distance`:
// 0 goals off → exact (green), 1–2 off → close (orange), ≥3 → neutral.
function toneForDiff(predicted: number | string, real: number | string | null): CellTone {
  if (typeof predicted !== "number" || typeof real !== "number") return "neutral";
  const d = Math.abs(predicted - real);
  if (d === 0) return "exact";
  if (d <= 2) return "close";
  return "neutral";
}

const CELL_BG: Record<CellTone, string> = {
  neutral: "bg-zinc-900",
  exact: "bg-success",
  close: "bg-orange-500",
};

function ScoreCell({ value, tone = "neutral" }: { value: number | string; tone?: CellTone }) {
  return (
    <span
      className={`font-oswald inline-flex h-7 w-7 items-center justify-center rounded-md text-base font-bold text-white shadow-sm ${CELL_BG[tone]}`}
    >
      {value}
    </span>
  );
}

function ScoreRow({
  label,
  labelTone,
  home,
  away,
  homeCellTone,
  awayCellTone,
  extra,
  topBorder,
}: {
  label: string;
  labelTone: string;
  home: number | string;
  away: number | string;
  homeCellTone?: CellTone;
  awayCellTone?: CellTone;
  extra: React.ReactNode;
  topBorder?: boolean;
}) {
  return (
    <div className={topBorder ? "border-t border-zinc-200" : ""}>
      <div className={SCORE_ROW_CLS}>
        <span
          className={`inline-flex justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${labelTone}`}
        >
          {label}
        </span>
        <span className="flex justify-center">
          <ScoreCell value={home} tone={homeCellTone} />
        </span>
        <span className="text-center text-zinc-300">–</span>
        <span className="flex justify-center">
          <ScoreCell value={away} tone={awayCellTone} />
        </span>
      </div>
      {extra && <div className="px-3 pb-1.5 pl-[3.75rem] text-[10px] leading-tight">{extra}</div>}
    </div>
  );
}

function KnockoutExtra({
  et,
  pen,
  qualifiedTeamName,
}: {
  et: boolean;
  pen: boolean;
  qualifiedTeamName: string | null;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-zinc-500">
      {et ? "Prórroga" : "Sin prórroga"} · {pen ? "penaltis" : "sin penaltis"}
      {qualifiedTeamName && (
        <>
          {" "}
          · pasa <strong className="text-zinc-700">{qualifiedTeamName}</strong>
        </>
      )}
    </span>
  );
}

export default async function MyScoresPage() {
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();

  const [
    { data: profile },
    { data: scoresRaw },
    { data: fixtures },
    { data: results },
    { data: myPredictions },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, initials").eq("user_id", userId).single(),
    supabase
      .from("prediction_scores")
      .select("fixture_id, prediction_type, points_total, points_breakdown")
      .eq("tournament_id", tournament.id)
      .eq("user_id", userId),
    supabase
      .from("fixtures")
      .select(
        `id, kickoff_at, stage_id, round_id, home_team_id, away_team_id,
           stage:stages ( code, sort_order ),
           round:rounds ( code, name, sort_order ),
           home_team:teams!fixtures_home_team_id_fkey ( display_name, code ),
           away_team:teams!fixtures_away_team_id_fkey ( display_name, code )`,
      )
      .eq("tournament_id", tournament.id),
    supabase
      .from("match_results")
      .select(
        "fixture_id, home_goals_90, away_goals_90, went_extra_time, went_penalties, qualified_team_id, result_status",
      )
      .eq("tournament_id", tournament.id)
      .eq("result_status", "confirmed"),
    supabase
      .from("match_predictions")
      .select(
        "fixture_id, home_goals_90, away_goals_90, predicts_extra_time, predicts_penalties, predicted_qualified_team_id",
      )
      .eq("tournament_id", tournament.id)
      .eq("user_id", userId),
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
        home_team_id: string | null;
        away_team_id: string | null;
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
        qualified_team_id: r.qualified_team_id as string | null,
      },
    ]),
  );
  const predictionByFixture = new Map(
    (myPredictions ?? []).map((p) => [
      p.fixture_id as string,
      {
        h: p.home_goals_90,
        a: p.away_goals_90,
        et: p.predicts_extra_time ?? false,
        pen: p.predicts_penalties ?? false,
        qualified_team_id: p.predicted_qualified_team_id as string | null,
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
      const prediction = predictionByFixture.get(s.fixture_id!) ?? null;
      const isKnockout = stageCode !== "group_stage";
      const teamNameForId = (id: string | null) => {
        if (!id) return null;
        if (id === fx.home_team_id) return fx.home_team?.display_name ?? null;
        if (id === fx.away_team_id) return fx.away_team?.display_name ?? null;
        return null;
      };
      return {
        fixture_id: s.fixture_id!,
        stageCode,
        isKnockout,
        roundName: fx.round?.name ?? "—",
        roundSort: fx.round?.sort_order ?? 0,
        kickoff: fx.kickoff_at,
        homeTeam: fx.home_team?.display_name ?? "TBD",
        awayTeam: fx.away_team?.display_name ?? "TBD",
        result,
        prediction,
        realQualifiedTeamName: result ? teamNameForId(result.qualified_team_id) : null,
        myQualifiedTeamName: prediction ? teamNameForId(prediction.qualified_team_id) : null,
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
    <main className="mx-auto max-w-6xl p-10">
      <h1 className="text-2xl font-bold">Clasificación</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Tu puntuación desglosada — {profile?.display_name ?? "jugador"}. Cada partido confirmado
        aparece como una barra; pulsa <strong>ⓘ</strong> para ver el detalle por criterio.
      </p>

      <ClasificacionTabs active="mis-predicciones" />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="border-success-light bg-success-light rounded-md border p-4">
          <p className="text-success-fg text-xs font-semibold uppercase">Total</p>
          <p className="text-success-fg font-oswald mt-1 text-3xl font-bold">{grandTotal}</p>
        </div>
        {CATEGORY_ORDER.map((cat) => (
          <div
            key={cat}
            className="rounded-md border border-zinc-200 bg-white p-4"
            title={CATEGORY_DESCRIPTIONS[cat]}
          >
            <p className="text-xs font-semibold text-zinc-500 uppercase">{CATEGORY_LABELS[cat]}</p>
            <p className="font-oswald mt-1 text-2xl font-bold">{totals[cat]}</p>
          </div>
        ))}
      </section>

      <h2 className="mt-8 text-lg font-bold">Por partido</h2>
      {matchScores.length === 0 ? (
        <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Aún no hay partidos con resultado confirmado para mostrar.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {matchScores.map((m) => (
            <li
              key={m.fixture_id}
              className="flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <Link
                  href={`/clasificacion/partido/${m.fixture_id}`}
                  className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold hover:underline"
                >
                  <TeamName name={m.homeTeam} />
                  <span className="text-xs font-normal text-zinc-400">vs.</span>
                  <TeamName name={m.awayTeam} />
                </Link>
                <span className="text-[11px] whitespace-nowrap text-zinc-400">
                  {m.roundName} · {formatMadridDateTime(m.kickoff)}
                </span>
              </div>

              <div className="mt-2.5 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50/70 text-sm">
                <ScoreRow
                  label="Real"
                  labelTone="bg-warning-light text-warning-fg"
                  home={m.result?.h ?? "—"}
                  away={m.result?.a ?? "—"}
                  extra={
                    m.isKnockout && m.result ? (
                      <KnockoutExtra
                        et={m.result.went_extra_time}
                        pen={m.result.went_penalties}
                        qualifiedTeamName={m.realQualifiedTeamName}
                      />
                    ) : null
                  }
                />
                <ScoreRow
                  label="Tú"
                  labelTone="bg-info-light text-info-fg"
                  home={m.prediction?.h ?? "—"}
                  away={m.prediction?.a ?? "—"}
                  homeCellTone={toneForDiff(m.prediction?.h ?? "—", m.result?.h ?? null)}
                  awayCellTone={toneForDiff(m.prediction?.a ?? "—", m.result?.a ?? null)}
                  extra={
                    m.isKnockout && m.prediction ? (
                      <KnockoutExtra
                        et={m.prediction.et}
                        pen={m.prediction.pen}
                        qualifiedTeamName={m.myQualifiedTeamName}
                      />
                    ) : null
                  }
                  topBorder
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <PointsBar value={m.points} max={m.max} />
                </div>
                <span className="font-oswald shrink-0 text-xs whitespace-nowrap text-zinc-500">
                  {m.points}/{m.max}
                </span>
                <BreakdownPopover pointsTotal={m.points}>
                  <BreakdownTable breakdown={m.breakdown} pointsTotal={m.points} />
                </BreakdownPopover>
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
