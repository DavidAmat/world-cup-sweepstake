import React from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { getInitialLockState } from "@/lib/predictions/initialLock";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { Badge } from "@/components/ui/Badge";
import { TeamName } from "@/components/ui/TeamName";
import { Lock, Unlock } from "lucide-react";
import { GROUP_CODES, GROUP_QUALIFIERS } from "./schemas";
import {
  saveInitialPredictions,
  lockInitialPredictions,
  unlockInitialPredictions,
} from "./actions";

type SearchParams = Promise<{ error?: string; ok?: string }>;

const INPUT_CLS = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

export default async function InitialPredictionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, ok } = await searchParams;
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();
  const { lockAt, locked, overriding, fechaActual } = await getInitialLockState(tournament.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();
  const isAdmin = profile?.role === "admin";

  const { data: tournamentFull } = await supabase
    .from("tournaments")
    .select("initial_predictions_locked_at")
    .eq("id", tournament.id)
    .single();
  const manuallyLocked = !!(
    tournamentFull as { initial_predictions_locked_at: string | null } | null
  )?.initial_predictions_locked_at;

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
    .select("group_code, team_id")
    .eq("tournament_id", tournament.id)
    .eq("user_id", userId);

  // group_code → Set(team_id) (order is not predicted)
  const qualByGroup = new Map<string, Set<string>>();
  for (const row of gqp ?? []) {
    const set = qualByGroup.get(row.group_code) ?? new Set<string>();
    set.add(row.team_id);
    qualByGroup.set(row.group_code, set);
  }

  const teamName = (id: string | null | undefined) =>
    id ? (teamById.get(id)?.display_name ?? "—") : "—";

  return (
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Predicciones iniciales</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Campeón, subcampeón, pichichi, mejor jugador y clasificados de cada grupo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin &&
            (locked ? (
              <form action={unlockInitialPredictions}>
                <button
                  type="submit"
                  className="border-success/30 bg-success/10 text-success-fg hover:bg-success/20 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  <Unlock className="h-3.5 w-3.5" aria-hidden />
                  Desbloquear
                </button>
              </form>
            ) : (
              <form action={lockInitialPredictions}>
                <button
                  type="submit"
                  className="border-danger/30 bg-danger/10 text-danger-fg hover:bg-danger/20 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Bloquear
                </button>
              </form>
            ))}
          <Badge tone={locked ? "danger" : "success"}>{locked ? "Bloqueado" : "Abierto"}</Badge>
        </div>
      </div>

      <p className="mt-3 text-sm text-zinc-600">
        {locked ? (
          <>
            {manuallyLocked
              ? "Bloqueadas por el administrador."
              : "Se cerraron al empezar el torneo" +
                (lockAt ? ` (${formatMadridDateTime(lockAt)})` : "") +
                "."}{" "}
            Ya no se pueden editar.{" "}
            <Link href="/predictions/initial/public" className="underline">
              Ver las de todos
            </Link>
            .
          </>
        ) : (
          <>
            Puedes editarlas hasta que el administrador las bloquee
            {lockAt ? ` o empiece el primer partido (${formatMadridDateTime(lockAt)})` : ""}.
            Después serán solo lectura y públicas.
          </>
        )}
      </p>

      {overriding && (
        <p className="border-info-light bg-info-light text-info-fg mt-4 rounded-md border p-3 text-xs">
          🧪 Fecha simulada (FECHA_ACTUAL):{" "}
          <strong>{fechaActual ? formatMadridDateTime(fechaActual) : "—"} (Madrid)</strong>. El
          bloqueo se evalúa contra esta fecha, no la real.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {ok === "saved" && (
        <p className="border-success-light bg-success-light text-success-fg mt-4 rounded-md border p-3 text-sm">
          Predicciones guardadas.
        </p>
      )}
      {ok === "locked" && (
        <p className="border-danger/30 bg-danger/10 text-danger-fg mt-4 rounded-lg border p-3 text-sm">
          Predicciones iniciales bloqueadas. Los usuarios ya no pueden modificarlas.
        </p>
      )}
      {ok === "unlocked" && (
        <p className="border-success-light bg-success-light text-success-fg mt-4 rounded-lg border p-3 text-sm">
          Predicciones iniciales desbloqueadas. Los usuarios pueden volver a editarlas.
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
          <fieldset className="rounded-md border border-zinc-200 p-4">
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

          <fieldset className="rounded-md border border-zinc-200 p-4">
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

          <fieldset className="rounded-md border border-zinc-200 p-4">
            <legend className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Clasificados de cada grupo
            </legend>
            <p className="mb-3 text-xs text-zinc-500">
              Marca exactamente <strong>{GROUP_QUALIFIERS}</strong> equipos por grupo (los que crees
              que pasan de ronda). El orden no importa.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {GROUP_CODES.map((g) => {
                const groupTeams = teamsByGroup.get(g) ?? [];
                const selected = qualByGroup.get(g) ?? new Set<string>();
                return (
                  <fieldset key={g} className="rounded-md border border-zinc-200 p-3">
                    <legend className="px-1 text-sm font-semibold">Grupo {g}</legend>
                    <div className="flex flex-col gap-1.5">
                      {groupTeams.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name={`qual_${g}`}
                            value={t.id}
                            defaultChecked={selected.has(t.id)}
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                          <TeamName name={t.display_name} />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Guardar predicciones
            </button>
            <Link
              href="/predictions/initial/public"
              className="text-sm text-zinc-600 underline hover:text-zinc-900"
            >
              Ver vista pública
            </Link>
          </div>
          <p className="text-xs text-zinc-500">
            Campeón, subcampeón, pichichi y mejor jugador puedes dejarlos para luego. Los
            clasificados requieren {GROUP_QUALIFIERS} equipos en cada grupo para poder guardar.
            Editable mientras el torneo no haya empezado.
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
  qualByGroup: Map<string, Set<string>>;
  teamName: (id: string | null | undefined) => string;
}) {
  return (
    <section className="mt-6 flex flex-col gap-6">
      <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-2">
        <Field label="Campeón" value={<TeamName name={championName} />} />
        <Field label="Subcampeón" value={<TeamName name={runnerUpName} />} />
        <Field label="Pichichi" value={topScorer} />
        <Field label="Mejor jugador" value={bestPlayer} />
      </div>
      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Clasificados de grupo
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {GROUP_CODES.map((g) => {
            const ids = [...(qualByGroup.get(g) ?? [])];
            return (
              <div key={g} className="text-sm">
                <span className="font-semibold">Grupo {g}: </span>
                <span className="inline-flex flex-wrap items-center gap-1 text-zinc-600">
                  {ids.length
                    ? ids.map((id, i) => (
                        <span key={id} className="inline-flex items-center gap-1">
                          {i > 0 && <span className="text-zinc-400">·</span>}
                          <TeamName name={teamName(id)} />
                        </span>
                      ))
                    : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
