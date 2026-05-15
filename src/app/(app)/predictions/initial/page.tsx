import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { getInitialLockState } from "@/lib/predictions/initialLock";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { Badge } from "@/components/ui/Badge";
import { GROUP_CODES } from "./schemas";
import { saveInitialPredictions } from "./actions";

type SearchParams = Promise<{ error?: string; ok?: string }>;

const INPUT_CLS =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

export default async function InitialPredictionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, ok } = await searchParams;
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();
  const { lockAt, locked } = await getInitialLockState(tournament.id);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, code, display_name, group_code")
    .eq("tournament_id", tournament.id)
    .order("display_name", { ascending: true });

  const teamList = teams ?? [];
  const teamById = new Map(teamList.map((t) => [t.id, t]));
  const teamsByGroup = new Map<string, typeof teamList>();
  for (const g of GROUP_CODES) {
    teamsByGroup.set(
      g,
      teamList.filter((t) => t.group_code === g),
    );
  }

  const { data: pred } = await supabase
    .from("initial_predictions")
    .select("champion_team_id, runner_up_team_id, top_scorer_text, best_player_text, submitted_at")
    .eq("tournament_id", tournament.id)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: gqp } = await supabase
    .from("group_qualification_predictions")
    .select("group_code, team_id, predicted_position")
    .eq("tournament_id", tournament.id)
    .eq("user_id", userId);

  // group_code → { 1: teamId, 2: teamId }
  const qualByGroup = new Map<string, Record<number, string>>();
  for (const row of gqp ?? []) {
    const entry = qualByGroup.get(row.group_code) ?? {};
    if (row.predicted_position) entry[row.predicted_position] = row.team_id;
    qualByGroup.set(row.group_code, entry);
  }

  const teamName = (id: string | null | undefined) =>
    id ? (teamById.get(id)?.display_name ?? "—") : "—";

  return (
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Predicciones iniciales</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Campeón, subcampeón, pichichi, mejor jugador y clasificados de cada grupo.
          </p>
        </div>
        <Badge tone={locked ? "amber" : "emerald"}>{locked ? "Bloqueado" : "Abierto"}</Badge>
      </div>

      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        {locked ? (
          <>
            Las predicciones se cerraron al empezar el torneo
            {lockAt ? ` (${formatMadridDateTime(lockAt)} Madrid)` : ""}. Ya no se pueden editar.{" "}
            <Link href="/predictions/initial/public" className="underline">
              Ver las de todos
            </Link>
            .
          </>
        ) : (
          <>
            Puedes editarlas hasta que empiece el primer partido del torneo
            {lockAt ? ` — ${formatMadridDateTime(lockAt)} (Madrid)` : ""}. Después serán solo
            lectura y públicas.
          </>
        )}
      </p>

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

      {locked ? (
        <ReadOnlyView
          championName={teamName(pred?.champion_team_id)}
          runnerUpName={teamName(pred?.runner_up_team_id)}
          topScorer={pred?.top_scorer_text ?? "—"}
          bestPlayer={pred?.best_player_text ?? "—"}
          qualByGroup={qualByGroup}
          teamName={teamName}
        />
      ) : (
        <form action={saveInitialPredictions} className="mt-6 flex flex-col gap-6">
          <fieldset className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <legend className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Ganadores del torneo
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Campeón</span>
                <select
                  name="champion_team_id"
                  defaultValue={pred?.champion_team_id ?? ""}
                  className={INPUT_CLS}
                >
                  <option value="">— Sin elegir —</option>
                  {teamList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Subcampeón</span>
                <select
                  name="runner_up_team_id"
                  defaultValue={pred?.runner_up_team_id ?? ""}
                  className={INPUT_CLS}
                >
                  <option value="">— Sin elegir —</option>
                  {teamList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <legend className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Premios individuales
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Pichichi (máximo goleador)</span>
                <input
                  type="text"
                  name="top_scorer_text"
                  maxLength={80}
                  defaultValue={pred?.top_scorer_text ?? ""}
                  placeholder="p.ej. Messi"
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Mejor jugador del Mundial</span>
                <input
                  type="text"
                  name="best_player_text"
                  maxLength={80}
                  defaultValue={pred?.best_player_text ?? ""}
                  placeholder="p.ej. Mbappé"
                  className={INPUT_CLS}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Texto libre: escribe el nombre como quieras. El administrador validará los nombres al
              final del torneo.
            </p>
          </fieldset>

          <fieldset className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <legend className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Clasificados de cada grupo
            </legend>
            <p className="mb-3 text-xs text-zinc-500">
              Por cada grupo, quién pasa como 1.º y 2.º. Déjalo vacío si aún no lo tienes claro.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {GROUP_CODES.map((g) => {
                const groupTeams = teamsByGroup.get(g) ?? [];
                const qual = qualByGroup.get(g) ?? {};
                return (
                  <div
                    key={g}
                    className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <p className="mb-2 text-sm font-semibold">Grupo {g}</p>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs text-zinc-500">1.º clasificado</span>
                      <select
                        name={`qual_${g}_pos1`}
                        defaultValue={qual[1] ?? ""}
                        className={INPUT_CLS}
                      >
                        <option value="">— Sin elegir —</option>
                        {groupTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.display_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="mt-2 flex flex-col gap-1 text-sm">
                      <span className="text-xs text-zinc-500">2.º clasificado</span>
                      <select
                        name={`qual_${g}_pos2`}
                        defaultValue={qual[2] ?? ""}
                        className={INPUT_CLS}
                      >
                        <option value="">— Sin elegir —</option>
                        {groupTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.display_name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Guardar predicciones
            </button>
            <Link
              href="/predictions/initial/public"
              className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Ver vista pública
            </Link>
          </div>
          <p className="text-xs text-zinc-500">
            Puedes guardar parcialmente y completar más tarde, mientras el torneo no haya empezado.
          </p>
        </form>
      )}
    </main>
  );
}

function ReadOnlyView({
  championName,
  runnerUpName,
  topScorer,
  bestPlayer,
  qualByGroup,
  teamName,
}: {
  championName: string;
  runnerUpName: string;
  topScorer: string;
  bestPlayer: string;
  qualByGroup: Map<string, Record<number, string>>;
  teamName: (id: string | null | undefined) => string;
}) {
  return (
    <section className="mt-6 flex flex-col gap-6">
      <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
        <Field label="Campeón" value={championName} />
        <Field label="Subcampeón" value={runnerUpName} />
        <Field label="Pichichi" value={topScorer} />
        <Field label="Mejor jugador" value={bestPlayer} />
      </div>
      <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Clasificados de grupo
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {GROUP_CODES.map((g) => {
            const q = qualByGroup.get(g) ?? {};
            return (
              <div key={g} className="text-sm">
                <span className="font-semibold">Grupo {g}: </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  1.º {teamName(q[1])} · 2.º {teamName(q[2])}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
