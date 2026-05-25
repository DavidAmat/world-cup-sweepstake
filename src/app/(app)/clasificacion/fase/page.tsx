import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { loadLeaderboardData, buildByStage } from "@/lib/scoring/leaderboard";
import { ClasificacionTabs } from "../Tabs";

export default async function FasePage() {
  const { userId } = await requireAuth();
  const tournament = await getDefaultTournament();
  const data = await loadLeaderboardData(tournament.id);
  const { stages, rows } = buildByStage(data);

  return (
    <main className="mx-auto max-w-5xl p-10">
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
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase">
              <tr>
                <th className="sticky left-0 bg-zinc-50 px-3 py-2 font-semibold">Participante</th>
                {stages.map((s) => (
                  <th key={s.code} className="px-3 py-2 text-right font-semibold">
                    {s.name}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Total partidos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isMe = row.profile.user_id === userId;
                return (
                  <tr key={row.profile.user_id} className="border-t border-zinc-100">
                    <td className="sticky left-0 bg-white px-3 py-2 font-medium">
                      {row.profile.display_name}
                      {isMe && (
                        <span className="bg-info-light text-info-fg ml-1 rounded px-1.5 text-xs font-medium">
                          tú
                        </span>
                      )}
                    </td>
                    {stages.map((s) => (
                      <td key={s.code} className="px-3 py-2 text-right font-mono">
                        {row.byStage.get(s.code) ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-mono font-bold">{row.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
