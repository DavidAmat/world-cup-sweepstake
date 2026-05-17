import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { getMatchLockState, isFixtureLocked } from "@/lib/predictions/matchLock";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { Badge } from "@/components/ui/Badge";
import { saveRoundMatchPredictions, generateRandomMatchPredictions } from "./actions";

type SearchParams = Promise<{ round?: string; error?: string; ok?: string }>;

const INPUT_CLS =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const GOAL_CLS = `${INPUT_CLS} w-16 text-center`;

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

export default async function MatchPredictionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { round: roundParam, error, ok } = await searchParams;
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();
  const { appNow, overriding, fechaActual } = await getMatchLockState();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";

  // Rounds that actually have fixtures, ordered by sort_order.
  const [{ data: rounds }, { data: roundFixtures }] = await Promise.all([
    supabase
      .from("rounds")
      .select("id, code, name, sort_order")
      .eq("tournament_id", tournament.id)
      .order("sort_order", { ascending: true }),
    supabase.from("fixtures").select("round_id, kickoff_at").eq("tournament_id", tournament.id),
  ]);

  const roundIdsWithFixtures = new Set((roundFixtures ?? []).map((f) => f.round_id));
  const availableRounds = (rounds ?? []).filter((r) => roundIdsWithFixtures.has(r.id));

  if (availableRounds.length === 0) {
    return (
      <main className="mx-auto max-w-4xl p-10">
        <h1 className="text-2xl font-bold">Predicciones de partidos</h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Todavía no hay partidos cargados para este torneo.
        </p>
      </main>
    );
  }

  // Default round: first (by sort_order) with an unlocked fixture, else last.
  const firstOpen = availableRounds.find((r) =>
    (roundFixtures ?? []).some(
      (f) => f.round_id === r.id && !isFixtureLocked(f.kickoff_at, appNow),
    ),
  );
  const selectedRound =
    availableRounds.find((r) => r.code === roundParam) ??
    firstOpen ??
    availableRounds[availableRounds.length - 1];

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

  const { data: preds } = await supabase
    .from("match_predictions")
    .select(
      "fixture_id, home_goals_90, away_goals_90, predicts_extra_time, predicts_penalties, predicted_qualified_team_id",
    )
    .eq("tournament_id", tournament.id)
    .eq("user_id", userId);
  const predByFixture = new Map((preds ?? []).map((p) => [p.fixture_id, p]));

  const isKnockout = (f: Fixture) => (f.stage?.code ?? "group_stage") !== "group_stage";

  return (
    <main className="mx-auto max-w-4xl p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Predicciones de partidos</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Marcador a 90&apos;. En eliminatorias, además prórroga, penaltis y equipo que pasa. Cada
            partido se bloquea 24&nbsp;h antes del inicio.
          </p>
        </div>
        <Link href="/predictions/matches/public" className="text-sm whitespace-nowrap underline">
          Vista pública
        </Link>
      </div>

      {overriding && (
        <p className="mt-4 rounded-md border border-sky-300 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          🧪 Fecha simulada (FECHA_ACTUAL):{" "}
          <strong>{fechaActual ? formatMadridDateTime(fechaActual) : "—"} (Madrid)</strong>. El
          bloqueo de cada partido se evalúa contra esta fecha.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {ok === "saved" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Predicciones guardadas.
        </p>
      )}
      {ok === "random" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Predicciones aleatorias generadas para todos tus partidos abiertos.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <form method="get" className="flex items-end gap-3">
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

        {isAdmin && (
          <form action={generateRandomMatchPredictions}>
            <button
              type="submit"
              className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
              title="Herramienta de prueba (admin): rellena al azar todos tus partidos no bloqueados"
            >
              🎲 Generar predicciones aleatorias
            </button>
          </form>
        )}
      </div>

      <form action={saveRoundMatchPredictions} className="mt-6">
        <input type="hidden" name="round" value={selectedRound.code} />
        <ul className="flex flex-col gap-3">
          {fixtures.map((f) => {
            const locked = isFixtureLocked(f.kickoff_at, appNow);
            const noTeams = !f.home_team_id || !f.away_team_id;
            const kn = isKnockout(f);
            const p = predByFixture.get(f.id);
            const home = f.home_team?.display_name ?? f.home_team?.code ?? "—";
            const away = f.away_team?.display_name ?? f.away_team?.code ?? "—";

            return (
              <li
                key={f.id}
                className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold">
                      {home} <span className="text-zinc-400">vs</span> {away}
                    </span>
                    <span className="ml-2 text-xs text-zinc-500">
                      {formatMadridDateTime(f.kickoff_at)} (Madrid)
                    </span>
                  </div>
                  <Badge tone={locked ? "amber" : "emerald"}>
                    {locked ? "Bloqueado" : "Abierto"}
                  </Badge>
                </div>

                {noTeams ? (
                  <p className="mt-3 text-sm text-zinc-500">
                    ⏳ Equipos por definir — no se puede predecir todavía.
                  </p>
                ) : locked ? (
                  <ReadOnly
                    p={p}
                    kn={kn}
                    qualifiedName={
                      p?.predicted_qualified_team_id === f.home_team_id
                        ? home
                        : p?.predicted_qualified_team_id === f.away_team_id
                          ? away
                          : "—"
                    }
                  />
                ) : (
                  <EditFixture
                    fid={f.id}
                    kn={kn}
                    home={home}
                    away={away}
                    homeId={f.home_team_id!}
                    awayId={f.away_team_id!}
                    p={p}
                  />
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Guardar jornada
          </button>
          <span className="text-xs text-zinc-500">
            Puedes rellenar solo algunos partidos; los vacíos no se guardan. Editable hasta
            24&nbsp;h antes de cada partido.
          </span>
        </div>
      </form>
    </main>
  );
}

type Pred = {
  home_goals_90: number;
  away_goals_90: number;
  predicts_extra_time: boolean;
  predicts_penalties: boolean;
  predicted_qualified_team_id: string | null;
};

function EditFixture({
  fid,
  kn,
  home,
  away,
  homeId,
  awayId,
  p,
}: {
  fid: string;
  kn: boolean;
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  p: Pred | undefined;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-40 truncate text-right">{home}</span>
        <input
          type="number"
          name={`h90_${fid}`}
          min={0}
          defaultValue={p?.home_goals_90 ?? ""}
          className={GOAL_CLS}
          aria-label={`Goles ${home} a 90'`}
        />
        <span className="text-zinc-400">-</span>
        <input
          type="number"
          name={`a90_${fid}`}
          min={0}
          defaultValue={p?.away_goals_90 ?? ""}
          className={GOAL_CLS}
          aria-label={`Goles ${away} a 90'`}
        />
        <span className="w-40 truncate">{away}</span>
      </div>

      {kn && (
        <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="text-xs text-zinc-500">
            Solo si el partido acaba empatado a 90&apos; (eliminatoria). No se predice el resultado
            de la prórroga, solo si la hay, si hay penaltis y qué equipo pasa.
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name={`et_${fid}`}
              defaultChecked={p?.predicts_extra_time ?? false}
              className="h-4 w-4"
            />
            <span>Habrá prórroga</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name={`pen_${fid}`}
              defaultChecked={p?.predicts_penalties ?? false}
              className="h-4 w-4"
            />
            <span>Se decide en los penaltis</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Equipo que pasa</span>
            <select
              name={`qual_${fid}`}
              defaultValue={p?.predicted_qualified_team_id ?? ""}
              className={INPUT_CLS}
            >
              <option value="">— Sin elegir —</option>
              <option value={homeId}>{home}</option>
              <option value={awayId}>{away}</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function ReadOnly({
  p,
  kn,
  qualifiedName,
}: {
  p: Pred | undefined;
  kn: boolean;
  qualifiedName: string;
}) {
  if (!p) {
    return <p className="mt-3 text-sm text-zinc-500">— sin predicción —</p>;
  }
  return (
    <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
      <p>
        90&apos;: <strong>{p.home_goals_90}</strong> - <strong>{p.away_goals_90}</strong>
      </p>
      {kn && p.predicts_extra_time && <p>Prórroga{p.predicts_penalties ? " · penaltis" : ""}</p>}
      {kn && <p className="text-zinc-500">Pasa: {qualifiedName}</p>}
    </div>
  );
}
