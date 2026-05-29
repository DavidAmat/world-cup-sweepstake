import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { TeamName } from "@/components/ui/TeamName";
import {
  computeGroupTables,
  computeAdvancingTeams,
  BEST_THIRDS_ADVANCE,
  type FixtureForTable,
} from "@/lib/scoring/scoreGroup";
import { GROUP_CODES } from "@/app/(app)/predictions/initial/schemas";
import { ListOrdered, Trophy } from "lucide-react";

type StageRel = { code: string } | { code: string }[] | null;
function stageCode(s: StageRel): string | null {
  if (!s) return null;
  return Array.isArray(s) ? (s[0]?.code ?? null) : s.code;
}

export default async function AdminStandingsPage() {
  const { supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();

  const [teamsRes, fixturesRes, resultsRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, code, display_name, group_code")
      .eq("tournament_id", tournament.id),
    supabase
      .from("fixtures")
      .select("id, group_code, home_team_id, away_team_id, stage:stages(code)")
      .eq("tournament_id", tournament.id),
    supabase
      .from("match_results")
      .select("fixture_id, home_goals_90, away_goals_90, result_status")
      .eq("tournament_id", tournament.id),
  ]);

  const teams = teamsRes.data ?? [];
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamLabel = (id: string) => teamById.get(id)?.display_name ?? id;

  const confirmed = new Map<string, { home: number; away: number }>();
  for (const r of resultsRes.data ?? []) {
    if (r.result_status !== "confirmed") continue;
    confirmed.set(r.fixture_id, { home: r.home_goals_90 ?? 0, away: r.away_goals_90 ?? 0 });
  }

  const fixturesForTable: FixtureForTable[] = [];
  for (const f of (fixturesRes.data ?? []) as {
    id: string;
    group_code: string | null;
    home_team_id: string | null;
    away_team_id: string | null;
    stage: StageRel;
  }[]) {
    if (stageCode(f.stage) !== "group_stage") continue;
    if (!f.group_code || !f.home_team_id || !f.away_team_id) continue;
    const r = confirmed.get(f.id);
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
  const advancing = computeAdvancingTeams(groupTables, GROUP_CODES.length, BEST_THIRDS_ADVANCE);

  return (
    <main className="mx-auto max-w-5xl p-10">
      <div className="flex items-center gap-2">
        <ListOrdered className="h-5 w-5 text-zinc-500" aria-hidden />
        <h1 className="text-2xl font-bold">Clasificación de grupos</h1>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        Calculada en vivo desde los resultados <strong>confirmados</strong>. Pasan los 2 primeros de
        cada grupo y los {BEST_THIRDS_ADVANCE} mejores terceros. Para corregir algo, edita los
        resultados en{" "}
        <Link href="/admin/results" className="underline">
          Resultados
        </Link>
        .
      </p>

      {/* Per-group standings */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {GROUP_CODES.map((g) => {
          const table = groupTables.get(g);
          return (
            <div key={g} className="overflow-hidden rounded-xl border border-zinc-200">
              <div className="flex items-baseline justify-between bg-zinc-50 px-3 py-2">
                <span className="text-sm font-semibold">Grupo {g}</span>
                {!table?.complete && <span className="text-[11px] text-zinc-400">incompleto</span>}
              </div>
              {!table || table.rows.length === 0 ? (
                <p className="px-3 py-4 text-xs text-zinc-400">Sin resultados todavía.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] text-zinc-400">
                    <tr>
                      <th className="px-3 py-1 font-medium">#</th>
                      <th className="px-1 py-1 font-medium">Equipo</th>
                      <th className="px-1 py-1 text-center font-medium">PJ</th>
                      <th className="px-1 py-1 text-center font-medium">Pts</th>
                      <th className="px-1 py-1 text-center font-medium">DG</th>
                      <th className="px-3 py-1 text-center font-medium">GF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {table.rows.map((row, i) => {
                      const advanced = advancing.advancing.has(row.team_id);
                      const isThird = i === 2;
                      const tone =
                        i < 2
                          ? "bg-success/5"
                          : isThird && advanced
                            ? "bg-info/5"
                            : isThird
                              ? "bg-warning/5"
                              : "";
                      return (
                        <tr key={row.team_id} className={tone}>
                          <td className="px-3 py-1.5 text-zinc-500">{i + 1}</td>
                          <td className="px-1 py-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              <TeamName name={teamLabel(row.team_id)} />
                              {i < 2 && (
                                <span className="text-success-fg text-[10px] font-semibold">✓</span>
                              )}
                              {isThird && advanced && (
                                <span className="text-info-fg text-[10px] font-semibold">
                                  3.º ✓
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-1 py-1.5 text-center text-zinc-500">{row.played}</td>
                          <td className="px-1 py-1.5 text-center font-semibold">{row.pts}</td>
                          <td className="px-1 py-1.5 text-center text-zinc-500">
                            {row.gd > 0 ? `+${row.gd}` : row.gd}
                          </td>
                          <td className="px-3 py-1.5 text-center text-zinc-500">{row.gf}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </section>

      {/* Best thirds ranking */}
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-zinc-500" aria-hidden />
          <h2 className="text-lg font-semibold">Mejores terceros (pasan {BEST_THIRDS_ADVANCE})</h2>
        </div>
        {!advancing.allGroupsComplete && (
          <p className="border-warning/30 bg-warning/10 text-warning-fg mt-2 rounded-md border px-3 py-2 text-xs">
            Provisional: faltan grupos por completar. El ranking de terceros solo es definitivo (y
            puntúa) cuando los 12 grupos han terminado.
          </p>
        )}
        {advancing.thirds.length === 0 ? (
          <p className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            Aún no hay grupos completos con tercer clasificado.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Equipo</th>
                  <th className="px-2 py-2 font-medium">Grupo</th>
                  <th className="px-2 py-2 text-center font-medium">Pts</th>
                  <th className="px-2 py-2 text-center font-medium">DG</th>
                  <th className="px-2 py-2 text-center font-medium">GF</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {advancing.thirds.map((t, i) => (
                  <tr
                    key={t.team_id}
                    className={
                      advancing.allGroupsComplete && t.advanced
                        ? "bg-success/5"
                        : i < BEST_THIRDS_ADVANCE
                          ? "bg-info/5"
                          : ""
                    }
                  >
                    <td className="px-4 py-1.5 text-zinc-500">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <TeamName name={teamLabel(t.team_id)} />
                    </td>
                    <td className="px-2 py-1.5 text-zinc-500">{t.group_code}</td>
                    <td className="px-2 py-1.5 text-center font-semibold">{t.pts}</td>
                    <td className="px-2 py-1.5 text-center text-zinc-500">
                      {t.gd > 0 ? `+${t.gd}` : t.gd}
                    </td>
                    <td className="px-2 py-1.5 text-center text-zinc-500">{t.gf}</td>
                    <td className="px-4 py-1.5">
                      {advancing.allGroupsComplete ? (
                        t.advanced ? (
                          <span className="text-success-fg text-xs font-semibold">Clasifica</span>
                        ) : (
                          <span className="text-xs text-zinc-400">Eliminado</span>
                        )
                      ) : (
                        <span className="text-info-fg text-xs">
                          {i < BEST_THIRDS_ADVANCE ? "Pasaría" : "Fuera"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
