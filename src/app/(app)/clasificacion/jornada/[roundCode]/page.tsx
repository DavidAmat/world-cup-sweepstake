import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { avatarUrlFor } from "@/lib/profiles/avatars";
import { ClasificacionTabs } from "../../Tabs";
import {
  RoundDetailTable,
  type RoundDetailFixture,
  type RoundDetailProfile,
} from "./RoundDetailTable";

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
  const pointsByUserFixture: Record<string, Record<string, number>> = {};
  const totalByUser = new Map<string, number>();
  for (const s of scores) {
    if (!s.fixture_id) continue;
    if (!pointsByUserFixture[s.user_id]) pointsByUserFixture[s.user_id] = {};
    pointsByUserFixture[s.user_id][s.fixture_id] = s.points_total;
    totalByUser.set(s.user_id, (totalByUser.get(s.user_id) ?? 0) + s.points_total);
  }

  const sortedProfiles: RoundDetailProfile[] = [...(profiles ?? [])]
    .sort((a, b) => (totalByUser.get(b.user_id) ?? 0) - (totalByUser.get(a.user_id) ?? 0))
    .map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      initials: p.initials,
      avatarUrl: avatarUrlFor(p.display_name),
    }));

  const fixtureRows: RoundDetailFixture[] = fixtures.map((f) => {
    const result = resultByFixture.get(f.id);
    return {
      id: f.id,
      kickoff_at: f.kickoff_at,
      home: f.home_team?.display_name ?? "TBD",
      away: f.away_team?.display_name ?? "TBD",
      resultLabel: result ? `${result.h}-${result.a}` : null,
    };
  });

  return (
    <main className="mx-auto max-w-7xl p-10">
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

      <RoundDetailTable
        fixtures={fixtureRows}
        profiles={sortedProfiles}
        pointsByUserFixture={pointsByUserFixture}
        userId={userId}
      />

      <p className="mt-4 text-xs text-zinc-500">
        Pulsa un partido para ver el desglose detallado y comparar las predicciones de cada
        participante.
      </p>
    </main>
  );
}
