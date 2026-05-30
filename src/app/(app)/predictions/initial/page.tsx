import React from "react";
import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { getInitialLockState } from "@/lib/predictions/initialLock";
import { Badge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { TeamName } from "@/components/ui/TeamName";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Lock, Unlock } from "lucide-react";
import {
  computeGroupTables,
  computeAdvancingTeams,
  BEST_THIRDS_ADVANCE,
  type FixtureForTable,
} from "@/lib/scoring/scoreGroup";
import { DEFAULT_SCORING_RULES_V1 } from "@/lib/scoring/rules";
import type { ScoringRulesV1 } from "@/lib/scoring/types";
import { GROUP_CODES } from "./schemas";
import { ClasificadosPicker } from "./ClasificadosPicker";
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
  const { locked } = await getInitialLockState(tournament.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();
  const isAdmin = profile?.role === "admin";

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

  // Props for the (client) clasificados picker.
  const pickerGroups = GROUP_CODES.map((g) => ({
    code: g,
    teams: (teamsByGroup.get(g) ?? []).map((t) => ({ id: t.id, name: t.display_name })),
  }));
  const pickerInitial: Record<string, string[]> = {};
  for (const g of GROUP_CODES) pickerInitial[g] = [...(qualByGroup.get(g) ?? [])];

  const teamName = (id: string | null | undefined) =>
    id ? (teamById.get(id)?.display_name ?? "—") : "—";

  // Group-stage results → table → top-2 = qualified teams. Only shown
  // once the admin has locked initial predictions AND every group has
  // all 6 matches confirmed (jornadas 1, 2 y 3 completas).
  const [groupFixturesRes, resultsRes, rulesRes] = await Promise.all([
    supabase
      .from("fixtures")
      .select("id, group_code, home_team_id, away_team_id, stage:stages(code)")
      .eq("tournament_id", tournament.id),
    supabase
      .from("match_results")
      .select("fixture_id, home_goals_90, away_goals_90, result_status")
      .eq("tournament_id", tournament.id),
    supabase
      .from("scoring_rules")
      .select("rules")
      .eq("tournament_id", tournament.id)
      .eq("active", true)
      .maybeSingle(),
  ]);

  const confirmedResultByFixture = new Map<string, { home: number; away: number }>();
  for (const r of resultsRes.data ?? []) {
    if (r.result_status !== "confirmed") continue;
    confirmedResultByFixture.set(r.fixture_id, {
      home: r.home_goals_90 ?? 0,
      away: r.away_goals_90 ?? 0,
    });
  }

  type GroupFixtureRow = {
    id: string;
    group_code: string | null;
    home_team_id: string | null;
    away_team_id: string | null;
    stage: { code: string } | { code: string }[] | null;
  };

  function stageCode(s: GroupFixtureRow["stage"]): string | null {
    if (!s) return null;
    return Array.isArray(s) ? (s[0]?.code ?? null) : s.code;
  }

  const fixturesForTable: FixtureForTable[] = [];
  for (const f of (groupFixturesRes.data ?? []) as GroupFixtureRow[]) {
    if (stageCode(f.stage) !== "group_stage") continue;
    if (!f.group_code || !f.home_team_id || !f.away_team_id) continue;
    const r = confirmedResultByFixture.get(f.id);
    if (!r) continue;
    fixturesForTable.push({
      fixture_id: f.id,
      group_code: f.group_code,
      home_team_id: f.home_team_id,
      away_team_id: f.away_team_id,
      home_team_code: teamById.get(f.home_team_id)?.code ?? "",
      away_team_code: teamById.get(f.away_team_id)?.code ?? "",
      home_goals_90: r.home,
      away_goals_90: r.away,
    });
  }

  const groupTables = computeGroupTables(fixturesForTable, 6);
  // Advancing teams = top 2 per group + best thirds. byGroup gives, per group,
  // the teams that actually advanced (top 2 and, once all groups are complete,
  // its third if it ranks among the best thirds).
  const advancing = computeAdvancingTeams(groupTables, GROUP_CODES.length, BEST_THIRDS_ADVANCE);
  const qualifiedByGroup = advancing.byGroup;
  const allGroupsComplete = advancing.allGroupsComplete;

  const rules: ScoringRulesV1 =
    (rulesRes.data?.rules as ScoringRulesV1 | null) ?? DEFAULT_SCORING_RULES_V1;
  const teamCorrectPts = rules.group_qualification.team_correct;
  const showEvaluation = locked && allGroupsComplete;

  return (
    <main className="mx-auto max-w-5xl p-10">
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
                <SubmitButton
                  className="border-success/30 bg-success/10 text-success-fg hover:bg-success/20 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-70"
                  pendingText="Desbloqueando…"
                >
                  <Unlock className="h-3.5 w-3.5" aria-hidden />
                  Desbloquear
                </SubmitButton>
              </form>
            ) : (
              <form action={lockInitialPredictions}>
                <SubmitButton
                  className="border-danger/30 bg-danger/10 text-danger-fg hover:bg-danger/20 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-70"
                  pendingText="Bloqueando…"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Bloquear
                </SubmitButton>
              </form>
            ))}
          <Badge tone={locked ? "danger" : "success"}>{locked ? "Bloqueado" : "Abierto"}</Badge>
        </div>
      </div>

      <p className="mt-3 text-sm text-zinc-600">
        {locked ? (
          <>
            Bloqueadas por el administrador. Ya no se pueden editar.{" "}
            <Link href="/predictions/initial/public" className="underline">
              Ver las de todos
            </Link>
            .
          </>
        ) : (
          <>
            Puedes editarlas hasta que el administrador las bloquee. Después serán solo lectura y
            públicas.
          </>
        )}
      </p>

      {error && <ErrorBanner message={error} className="mt-4" />}
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
          qualifiedByGroup={qualifiedByGroup}
          showEvaluation={showEvaluation}
          teamCorrectPts={teamCorrectPts}
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

          <ClasificadosPicker groups={pickerGroups} initialSelected={pickerInitial} />
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
  qualifiedByGroup,
  showEvaluation,
  teamCorrectPts,
}: {
  championName: string;
  runnerUpName: string;
  topScorer: string;
  bestPlayer: string;
  qualByGroup: Map<string, Set<string>>;
  teamName: (id: string | null | undefined) => string;
  qualifiedByGroup: Map<string, Set<string>>;
  showEvaluation: boolean;
  teamCorrectPts: number;
}) {
  let grandTotal = 0;
  if (showEvaluation) {
    for (const g of GROUP_CODES) {
      const selected = qualByGroup.get(g) ?? new Set<string>();
      const qualified = qualifiedByGroup.get(g) ?? new Set<string>();
      let hits = 0;
      for (const id of selected) if (qualified.has(id)) hits += 1;
      grandTotal += hits * teamCorrectPts;
    }
  }

  return (
    <section className="mt-6 flex flex-col gap-6">
      <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-2">
        <Field label="Campeón" value={<TeamName name={championName} />} />
        <Field label="Subcampeón" value={<TeamName name={runnerUpName} />} />
        <Field label="Pichichi" value={topScorer} />
        <Field label="Mejor jugador" value={bestPlayer} />
      </div>
      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Clasificados de grupo
          </p>
          {showEvaluation && (
            <p className="text-xs text-zinc-600">
              Total clasificados:{" "}
              <span className="text-success-fg font-semibold">+{grandTotal} pts</span>
            </p>
          )}
        </div>
        {!showEvaluation && (
          <p className="mb-3 text-xs text-zinc-500">
            Los puntos se mostrarán cuando terminen las jornadas 1, 2 y 3 (todos los grupos
            completos).
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {GROUP_CODES.map((g) => {
            const selected = qualByGroup.get(g) ?? new Set<string>();
            const qualified = qualifiedByGroup.get(g) ?? new Set<string>();

            if (!showEvaluation) {
              const ids = [...selected];
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
            }

            // Show every team that is either predicted or qualified.
            const allIds = new Set<string>([...selected, ...qualified]);
            const items = [...allIds].map((id) => {
              const wasSelected = selected.has(id);
              const didQualify = qualified.has(id);
              return { id, wasSelected, didQualify };
            });
            items.sort((a, b) => {
              const ar = a.wasSelected && a.didQualify ? 0 : 1;
              const br = b.wasSelected && b.didQualify ? 0 : 1;
              if (ar !== br) return ar - br;
              return teamName(a.id).localeCompare(teamName(b.id), "es");
            });

            const hits = items.filter((i) => i.wasSelected && i.didQualify).length;
            const groupPts = hits * teamCorrectPts;

            return (
              <div key={g} className="rounded-md border border-zinc-100 bg-zinc-50/40 p-2">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">Grupo {g}</span>
                  <span className="text-xs text-zinc-600">
                    <span className="text-success-fg font-semibold">+{groupPts} pts</span>
                  </span>
                </div>
                <ul className="flex flex-col gap-1">
                  {items.map((it) => {
                    const correct = it.wasSelected && it.didQualify;
                    const missedQualifier = !it.wasSelected && it.didQualify;
                    const wrongPick = it.wasSelected && !it.didQualify;
                    return (
                      <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                        <span
                          className={
                            "inline-flex items-center gap-1.5 " +
                            (correct
                              ? "text-zinc-900"
                              : missedQualifier
                                ? "text-zinc-500"
                                : "text-zinc-500 line-through")
                          }
                        >
                          <TeamName name={teamName(it.id)} />
                          {missedQualifier && (
                            <span className="text-[10px] text-zinc-400 italic">(clasificó)</span>
                          )}
                        </span>
                        {correct ? (
                          <span
                            aria-label={`Acertaste: +${teamCorrectPts} puntos`}
                            className="border-success-light bg-success-light text-success-fg rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                          >
                            +{teamCorrectPts} pts
                          </span>
                        ) : (
                          <span
                            aria-label={
                              wrongPick ? "No pasó de ronda" : "Pasó de ronda, no la elegiste"
                            }
                            className="border-danger-light bg-danger-light text-danger-fg rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                          >
                            ✗
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
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
