import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { TeamName } from "@/components/ui/TeamName";
import { BreakdownTable } from "@/components/scoring/BreakdownTable";
import { BreakdownPopover } from "@/components/scoring/BreakdownPopover";
import { PointsBar } from "@/components/scoring/PointsBar";
import { maxPointsForFixture } from "@/lib/scoring/maxPoints";
import type { StageCode } from "@/lib/scoring/types";

type RouteParams = Promise<{ fixtureId: string }>;

const KNOCKOUT_STAGES = new Set<StageCode>([
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
]);

export default async function PartidoPage({ params }: { params: RouteParams }) {
  const { fixtureId } = await params;
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();

  const { data: fixture } = await supabase
    .from("fixtures")
    .select(
      `id, kickoff_at, group_code, home_team_id, away_team_id,
       stage:stages ( code, name ),
       round:rounds ( code, name ),
       home_team:teams!fixtures_home_team_id_fkey ( display_name, code ),
       away_team:teams!fixtures_away_team_id_fkey ( display_name, code )`,
    )
    .eq("tournament_id", tournament.id)
    .eq("id", fixtureId)
    .single();
  if (!fixture) notFound();

  const stageCode = (fixture.stage?.code ?? "group_stage") as StageCode;
  const isKnockout = KNOCKOUT_STAGES.has(stageCode);

  const [{ data: result }, { data: preds }, { data: scores }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("match_results")
        .select(
          "home_goals_90, away_goals_90, went_extra_time, went_penalties, qualified_team_id, result_status",
        )
        .eq("fixture_id", fixtureId)
        .maybeSingle(),
      supabase
        .from("match_predictions")
        .select(
          "user_id, home_goals_90, away_goals_90, predicts_extra_time, predicts_penalties, predicted_qualified_team_id",
        )
        .eq("fixture_id", fixtureId),
      supabase
        .from("prediction_scores")
        .select("user_id, points_total, points_breakdown")
        .eq("fixture_id", fixtureId),
      supabase.from("profiles").select("user_id, display_name, initials").order("display_name"),
    ]);

  const homeTeam = fixture.home_team?.display_name ?? "TBD";
  const awayTeam = fixture.away_team?.display_name ?? "TBD";
  const qualifiedTeamId = result?.qualified_team_id ?? null;
  const qualifiedTeamName =
    qualifiedTeamId === fixture.home_team_id
      ? homeTeam
      : qualifiedTeamId === fixture.away_team_id
        ? awayTeam
        : null;
  const confirmedResult =
    result && result.result_status === "confirmed"
      ? {
          went_extra_time: result.went_extra_time ?? false,
          went_penalties: result.went_penalties ?? false,
        }
      : null;
  const maxPts = maxPointsForFixture(stageCode, confirmedResult);

  const predByUser = new Map((preds ?? []).map((p) => [p.user_id, p]));
  const scoreByUser = new Map(
    (scores ?? []).map((s) => [
      s.user_id,
      {
        points_total: Number(s.points_total),
        breakdown: (s.points_breakdown ?? {}) as Record<string, unknown>,
      },
    ]),
  );

  const rows = (profiles ?? [])
    .map((p) => ({
      profile: p,
      prediction: predByUser.get(p.user_id) ?? null,
      score: scoreByUser.get(p.user_id) ?? null,
    }))
    .sort((a, b) => (b.score?.points_total ?? -1) - (a.score?.points_total ?? -1));

  function teamFromId(id: string | null | undefined): string {
    if (!id) return "—";
    if (id === fixture?.home_team_id) return homeTeam;
    if (id === fixture?.away_team_id) return awayTeam;
    return "—";
  }

  return (
    <main className="mx-auto max-w-4xl p-10">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-500 uppercase">
            {fixture.stage?.name ?? "Partido"} · {fixture.round?.name ?? ""}
            {fixture.group_code ? ` · Grupo ${fixture.group_code}` : ""}
          </p>
          <h1 className="text-2xl font-bold inline-flex flex-wrap items-center gap-2">
            <TeamName name={homeTeam} /> vs <TeamName name={awayTeam} />
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            {formatMadridDateTime(fixture.kickoff_at)} (Madrid)
          </p>
        </div>
        <Link href="/clasificacion/jornada" className="text-sm underline">
          ← Volver
        </Link>
      </div>

      <section className="mt-6 rounded-md border border-zinc-200 bg-white p-4 text-sm">
        <p className="text-xs font-semibold text-zinc-500 uppercase">Resultado oficial</p>
        {result && result.result_status === "confirmed" ? (
          <>
            <p className="mt-1 text-lg font-bold inline-flex flex-wrap items-center gap-1.5">
              <TeamName name={homeTeam} /> {result.home_goals_90} - {result.away_goals_90}{" "}
              <TeamName name={awayTeam} />
            </p>
            {isKnockout && (
              <p className="mt-1 text-xs text-zinc-600 inline-flex flex-wrap items-center gap-1">
                {result.went_extra_time ? "Con prórroga" : "Sin prórroga"} ·{" "}
                {result.went_penalties ? "Decidido en penaltis" : "Sin penaltis"}
                {qualifiedTeamName ? (
                  <> · Pasa: <TeamName name={qualifiedTeamName} /></>
                ) : null}
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              Máximo posible por participante: <strong>{maxPts}</strong> pts.
            </p>
          </>
        ) : (
          <p className="mt-1 text-zinc-600">Aún sin resultado oficial confirmado.</p>
        )}
      </section>

      <h2 className="mt-8 text-lg font-bold">Predicciones de cada participante</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map(({ profile, prediction, score }) => {
          const isMe = profile.user_id === userId;
          const pts = score?.points_total ?? 0;
          return (
            <li
              key={profile.user_id}
              className={
                "rounded-md border p-4 " +
                (isMe ? "border-info-light bg-info-light" : "border-zinc-200 bg-white")
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {profile.display_name}
                    {isMe && (
                      <span className="bg-info-light text-info-fg ml-1 rounded px-1.5 text-xs font-medium">
                        tú
                      </span>
                    )}
                  </p>
                  {prediction ? (
                    <p className="text-sm text-zinc-700">
                      Predicción: <strong>{prediction.home_goals_90}</strong>-
                      <strong>{prediction.away_goals_90}</strong>
                      {isKnockout && (
                        <>
                          {" · "}
                          {prediction.predicts_extra_time ? "prórroga" : "sin prórroga"}
                          {" · "}
                          {prediction.predicts_penalties ? "penaltis" : "sin penaltis"}
                          {" · pasa "}
                          <TeamName name={teamFromId(prediction.predicted_qualified_team_id)} />
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-500 italic">No envió predicción</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {score ? (
                    <BreakdownPopover
                      pointsTotal={pts}
                      label={`Ver desglose de ${profile.display_name}`}
                    >
                      <BreakdownTable breakdown={score.breakdown} pointsTotal={pts} />
                    </BreakdownPopover>
                  ) : (
                    <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                      sin puntos
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <PointsBar value={pts} max={maxPts} />
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
