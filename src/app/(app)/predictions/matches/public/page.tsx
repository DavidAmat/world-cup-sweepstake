import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { getMatchLockState, isFixtureLocked } from "@/lib/predictions/matchLock";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { Badge } from "@/components/ui/Badge";

type SearchParams = Promise<{ round?: string }>;

const INPUT_CLS =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

type TeamRef = { display_name: string; code: string } | null;
type Fixture = {
  id: string;
  kickoff_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team: TeamRef;
  away_team: TeamRef;
  stage: { code: string } | null;
};

export default async function PublicMatchPredictionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { round: roundParam } = await searchParams;
  const { supabase } = await requireAuth();
  const tournament = await getDefaultTournament();
  const { appNow, overriding, fechaActual } = await getMatchLockState();

  const [{ data: rounds }, { data: roundFixtures }, { data: profiles }] = await Promise.all([
    supabase
      .from("rounds")
      .select("id, code, name, sort_order")
      .eq("tournament_id", tournament.id)
      .order("sort_order", { ascending: true }),
    supabase.from("fixtures").select("round_id, kickoff_at").eq("tournament_id", tournament.id),
    supabase.from("profiles").select("user_id, display_name, initials").order("display_name"),
  ]);

  const roundIdsWithFixtures = new Set((roundFixtures ?? []).map((f) => f.round_id));
  const availableRounds = (rounds ?? []).filter((r) => roundIdsWithFixtures.has(r.id));

  if (availableRounds.length === 0) {
    return (
      <main className="mx-auto max-w-4xl p-10">
        <h1 className="text-2xl font-bold">Predicciones de partidos · vista pública</h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Todavía no hay partidos cargados para este torneo.
        </p>
      </main>
    );
  }

  const firstLocked = availableRounds.find((r) =>
    (roundFixtures ?? []).some((f) => f.round_id === r.id && isFixtureLocked(f.kickoff_at, appNow)),
  );
  const selectedRound =
    availableRounds.find((r) => r.code === roundParam) ?? firstLocked ?? availableRounds[0];

  const { data: fxData } = await supabase
    .from("fixtures")
    .select(
      `id, kickoff_at, home_team_id, away_team_id,
       home_team:teams!fixtures_home_team_id_fkey ( display_name, code ),
       away_team:teams!fixtures_away_team_id_fkey ( display_name, code ),
       stage:stages ( code )`,
    )
    .eq("tournament_id", tournament.id)
    .eq("round_id", selectedRound.id)
    .order("kickoff_at", { ascending: true });
  const fixtures = (fxData ?? []) as unknown as Fixture[];

  // RLS returns other users' rows only for locked fixtures, so this is safe
  // even though we query the whole round.
  const { data: preds } = await supabase
    .from("match_predictions")
    .select(
      "fixture_id, user_id, home_goals_90, away_goals_90, predicts_extra_time, home_goals_120, away_goals_120, predicts_penalties, predicted_qualified_team_id",
    )
    .eq("tournament_id", tournament.id)
    .in(
      "fixture_id",
      fixtures.map((f) => f.id),
    );

  type PredRow = NonNullable<typeof preds>[number];
  const predByFixtureUser = new Map<string, Map<string, PredRow>>();
  for (const p of preds ?? []) {
    const byUser = predByFixtureUser.get(p.fixture_id) ?? new Map<string, PredRow>();
    byUser.set(p.user_id, p);
    predByFixtureUser.set(p.fixture_id, byUser);
  }

  const users = profiles ?? [];

  return (
    <main className="mx-auto max-w-4xl p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Predicciones de partidos · vista pública</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Las predicciones de cada partido se hacen públicas cuando se bloquea (24&nbsp;h antes
            del inicio).
          </p>
        </div>
        <Link href="/predictions/matches" className="text-sm underline whitespace-nowrap">
          Mis predicciones
        </Link>
      </div>

      {overriding && (
        <p className="mt-4 rounded-md border border-sky-300 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          🧪 Fecha simulada (FECHA_ACTUAL):{" "}
          <strong>{fechaActual ? formatMadridDateTime(fechaActual) : "—"} (Madrid)</strong>.
        </p>
      )}

      <form method="get" className="mt-6 flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Jornada / ronda</span>
          <select name="round" defaultValue={selectedRound.code} className={INPUT_CLS}>
            {availableRounds.map((r) => (
              <option key={r.id} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Ver
        </button>
      </form>

      <section className="mt-6 flex flex-col gap-4">
        {fixtures.map((f) => {
          const locked = isFixtureLocked(f.kickoff_at, appNow);
          const kn = (f.stage?.code ?? "group_stage") !== "group_stage";
          const home = f.home_team?.display_name ?? f.home_team?.code ?? "—";
          const away = f.away_team?.display_name ?? f.away_team?.code ?? "—";
          const byUser = predByFixtureUser.get(f.id);

          return (
            <article
              key={f.id}
              className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">
                  {home} <span className="text-zinc-400">vs</span> {away}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {formatMadridDateTime(f.kickoff_at)} (Madrid)
                  </span>
                </div>
                <Badge tone={locked ? "amber" : "emerald"}>
                  {locked ? "Bloqueado" : "Abierto"}
                </Badge>
              </div>

              {!locked ? (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                  🔒 Se hará pública cuando se bloquee, 24&nbsp;h antes del partido.
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {users.map((u) => {
                    const p = byUser?.get(u.user_id);
                    const qualified =
                      p?.predicted_qualified_team_id === f.home_team_id
                        ? home
                        : p?.predicted_qualified_team_id === f.away_team_id
                          ? away
                          : "—";
                    return (
                      <div
                        key={u.user_id}
                        className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold dark:bg-zinc-700">
                            {u.initials}
                          </span>
                          <span className="font-medium">{u.display_name}</span>
                        </div>
                        {!p ? (
                          <p className="mt-1 text-zinc-500">— sin predicción —</p>
                        ) : (
                          <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                            90&apos;: <strong>{p.home_goals_90}</strong>-
                            <strong>{p.away_goals_90}</strong>
                            {kn && p.predicts_extra_time && (
                              <>
                                {" "}
                                · 120&apos;: {p.home_goals_120 ?? "—"}-{p.away_goals_120 ?? "—"}
                                {p.predicts_penalties ? " · penaltis" : ""}
                              </>
                            )}
                            {kn && <> · pasa: {qualified}</>}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
