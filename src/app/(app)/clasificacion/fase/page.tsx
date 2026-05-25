import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { loadLeaderboardData, buildByStage } from "@/lib/scoring/leaderboard";
import { ClasificacionTabs } from "../Tabs";
import { FaseTable } from "./FaseTable";

export default async function FasePage() {
  const { userId } = await requireAuth();
  const tournament = await getDefaultTournament();
  const data = await loadLeaderboardData(tournament.id);
  const { stages, rows } = buildByStage(data);

  return (
    <main className="mx-auto max-w-7xl p-10">
      <h1 className="text-2xl font-bold">Clasificación por fase</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Puntos por fase del torneo (grupos, dieciseisavos, octavos…). Permite ver quién acertó más
        en cada tramo, aunque haya empezado tarde.
      </p>

      <ClasificacionTabs active="fase" />

      {stages.length === 0 ? (
        <p className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Todavía no hay fases con resultados confirmados.
        </p>
      ) : (
        <FaseTable
          rows={rows.map((r) => ({
            profile: r.profile,
            total: r.total,
            byStage: Object.fromEntries(r.byStage),
          }))}
          stages={stages}
          userId={userId}
        />
      )}
    </main>
  );
}
