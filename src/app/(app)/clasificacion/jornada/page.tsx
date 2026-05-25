import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { loadLeaderboardData, buildByRound } from "@/lib/scoring/leaderboard";
import { ClasificacionTabs } from "../Tabs";

export default async function JornadaPage() {
  const { userId } = await requireAuth();
  const tournament = await getDefaultTournament();
  const data = await loadLeaderboardData(tournament.id);
  const { rounds, rows, totalsByRound } = buildByRound(data);

  return (
    <main className="mx-auto max-w-5xl p-10">
      <h1 className="text-2xl font-bold">Clasificación por jornada</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Puntos que cada participante ha sacado en cada jornada o ronda con resultados confirmados.
        Pulsa el nombre de una jornada para ver los partidos.
      </p>

      <ClasificacionTabs active="jornada" />

      {rounds.length === 0 ? (
        <p className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Todavía no hay jornadas con resultados confirmados.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase">
              <tr>
                <th className="sticky left-0 bg-zinc-50 px-3 py-2 font-semibold">Participante</th>
                {rounds.map((r) => (
                  <th key={r.code} className="px-3 py-2 text-right font-semibold">
                    <Link href={`/clasificacion/jornada/${r.code}`} className="hover:underline">
                      {r.name}
                    </Link>
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
                    {rounds.map((r) => (
                      <td key={r.code} className="px-3 py-2 text-right font-mono text-zinc-700">
                        {row.byRound.get(r.code) ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-mono font-bold">{row.total}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                <td className="sticky left-0 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500 uppercase">
                  Pts totales
                </td>
                {rounds.map((r) => (
                  <td key={r.code} className="px-3 py-2 text-right font-mono text-xs text-zinc-500">
                    {totalsByRound.get(r.code) ?? 0}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-500">
        Solo se incluyen las jornadas con al menos un resultado confirmado. Pulsa el nombre de la
        jornada para abrir su comparativa partido a partido.
      </p>
    </main>
  );
}
