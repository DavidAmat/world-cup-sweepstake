import Link from "next/link";
import { notFound } from "next/navigation";
import { Flag, Scale } from "lucide-react";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { TeamName } from "@/components/ui/TeamName";
import { BreakdownTable } from "@/components/scoring/BreakdownTable";
import { BreakdownPopover } from "@/components/scoring/BreakdownPopover";
import { PointsBar } from "@/components/scoring/PointsBar";
import { Avatar } from "@/components/profiles/Avatar";
import { avatarUrlFor } from "@/lib/profiles/avatars";
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

export default async function PartidoJustoPage({ params }: { params: RouteParams }) {
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

  const [{ data: realResult }, { data: fairResult }, { data: preds }, { data: scores }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("match_results")
        .select("home_goals_90, away_goals_90, went_extra_time, went_penalties, qualified_team_id, result_status")
        .eq("fixture_id", fixtureId)
        .maybeSingle(),
      supabase
        .from("fair_match_results")
        .select("home_goals_90, away_goals_90, went_extra_time, went_penalties, qualified_team_id")
        .eq("fixture_id", fixtureId)
        .maybeSingle(),
      supabase
        .from("match_predictions")
        .select(
          "user_id, home_goals_90, away_goals_90, predicts_extra_time, predicts_penalties, predicted_qualified_team_id",
        )
        .eq("fixture_id", fixtureId),
      supabase
        .from("fair_prediction_scores")
        .select("user_id, points_total, points_breakdown")
        .eq("fixture_id", fixtureId),
      supabase.from("profiles").select("user_id, display_name, initials").order("display_name"),
    ]);

  const homeTeam = fixture.home_team?.display_name ?? "TBD";
  const awayTeam = fixture.away_team?.display_name ?? "TBD";

  const teamFromId = (id: string | null | undefined): string => {
    if (!id) return "—";
    if (id === fixture.home_team_id) return homeTeam;
    if (id === fixture.away_team_id) return awayTeam;
    return "—";
  };

  const maxPts = fairResult
    ? maxPointsForFixture(stageCode, {
        went_extra_time: fairResult.went_extra_time ?? false,
        went_penalties: fairResult.went_penalties ?? false,
      })
    : maxPointsForFixture(stageCode, null);

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

  return (
    <main className="mx-auto max-w-6xl p-10">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-500 uppercase">
            {fixture.stage?.name ?? "Partido"} · {fixture.round?.name ?? ""}
            {fixture.group_code ? ` · Grupo ${fixture.group_code}` : ""}
          </p>
          <h1 className="inline-flex flex-wrap items-center gap-2 text-2xl font-bold">
            <TeamName name={homeTeam} /> vs <TeamName name={awayTeam} />
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            {formatMadridDateTime(fixture.kickoff_at)} (Madrid)
          </p>
        </div>
        <Link href="/porra-justa/predicciones" className="text-sm underline">
          ← Volver
        </Link>
      </div>

      {/* Real result */}
      <section className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
        <p className="text-xs font-semibold text-zinc-500 uppercase">
          <Flag className="mr-1 inline h-3 w-3" aria-hidden />
          Resultado real
        </p>
        {realResult && realResult.result_status === "confirmed" ? (
          <p className="font-oswald mt-1 inline-flex flex-wrap items-center gap-1.5 text-base text-zinc-600">
            <TeamName name={homeTeam} /> {realResult.home_goals_90} - {realResult.away_goals_90}{" "}
            <TeamName name={awayTeam} />
            {isKnockout && realResult.qualified_team_id && (
              <span className="text-xs">· pasó {teamFromId(realResult.qualified_team_id)}</span>
            )}
          </p>
        ) : (
          <p className="mt-1 text-zinc-600">Aún sin resultado oficial confirmado.</p>
        )}
      </section>

      {/* Resultado Justo (highlighted, bigger) */}
      <section className="border-special/30 bg-special-light/20 mt-3 rounded-md border p-4 text-sm">
        <p className="text-special-fg text-xs font-semibold uppercase">
          <Scale className="mr-1 inline h-3 w-3" aria-hidden />
          Resultado Justo
        </p>
        {fairResult ? (
          <>
            <p className="font-oswald mt-1 inline-flex flex-wrap items-center gap-2 text-2xl font-bold">
              <TeamName name={homeTeam} /> {fairResult.home_goals_90} - {fairResult.away_goals_90}{" "}
              <TeamName name={awayTeam} />
            </p>
            {isKnockout && (
              <p className="mt-1 text-xs text-zinc-600">
                {fairResult.went_extra_time
                  ? fairResult.went_penalties
                    ? "Decidido en penaltis"
                    : "Con prórroga"
                  : "Resuelto en el tiempo reglamentario"}{" "}
                · pasa <strong>{teamFromId(fairResult.qualified_team_id)}</strong>
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              Máximo posible por participante: <strong>{maxPts}</strong> pts.
            </p>
          </>
        ) : (
          <p className="mt-1 text-zinc-600">Todavía sin Resultado Justo calculado.</p>
        )}
      </section>

      <h2 className="mt-8 text-lg font-bold">Predicciones de cada participante (puntos justos)</h2>
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
                  <p className="flex items-center gap-2 font-semibold">
                    <Avatar
                      displayName={profile.display_name}
                      initials={profile.initials}
                      avatarUrl={avatarUrlFor(profile.display_name)}
                    />
                    <span>{profile.display_name}</span>
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
