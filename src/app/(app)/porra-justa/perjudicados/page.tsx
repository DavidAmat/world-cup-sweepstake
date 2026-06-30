import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { loadLeaderboardData, buildGeneralRanking } from "@/lib/scoring/leaderboard";
import { loadFairLeaderboardData } from "@/lib/scoring/fair/fairLeaderboard";
import { avatarUrlFor } from "@/lib/profiles/avatars";
import { Avatar } from "@/components/profiles/Avatar";
import { PorraJustaTabs } from "../Tabs";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// Perjudicados — ranks participants by how much the stoppage-time ("al 90")
// goals penalised them: diferencia = puntos justos − puntos reales. A positive
// difference means the player would have MORE points if those late goals had
// not happened, i.e. they were harmed the most.
export default async function PerjudicadosPage() {
  const { userId } = await requireAuth();
  const tournament = await getDefaultTournament();

  const [realData, fairData] = await Promise.all([
    loadLeaderboardData(tournament.id),
    loadFairLeaderboardData(tournament.id),
  ]);

  const realTotals = new Map(buildGeneralRanking(realData).map((r) => [r.profile.user_id, r.total]));
  const fairRanking = buildGeneralRanking(fairData);

  const rows = fairRanking
    .map((r) => {
      const real = realTotals.get(r.profile.user_id) ?? 0;
      const fair = r.total;
      return { profile: r.profile, real, fair, diff: fair - real };
    })
    // Most harmed first (biggest positive diff), then by fair total.
    .sort((a, b) => b.diff - a.diff || b.fair - a.fair);

  const maxAbsDiff = Math.max(1, ...rows.map((r) => Math.abs(r.diff)));

  return (
    <main className="mx-auto max-w-3xl p-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Scale className="text-special h-6 w-6" aria-hidden />
          Perjudicados
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Comparativa de la puntuación <strong>real</strong> frente a la <strong>justa</strong> (sin
          los goles del minuto 90 en adelante). La <em>diferencia</em> es{" "}
          <strong>justa − real</strong>: cuanto más alta y positiva, más le han penalizado esos goles
          tardíos.
        </p>
      </div>

      <PorraJustaTabs active="perjudicados" />

      {rows.length === 0 ? (
        <p className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Todavía no hay puntuaciones para comparar.
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase">
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Participante</th>
                <th className="px-3 py-2 text-right font-semibold">Real</th>
                <th className="px-3 py-2 text-right font-semibold">Justa</th>
                <th className="px-3 py-2 text-right font-semibold">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const isMe = r.profile.user_id === userId;
                const harmed = r.diff > 0;
                const benefited = r.diff < 0;
                const barPct = Math.round((Math.abs(r.diff) / maxAbsDiff) * 100);
                return (
                  <tr
                    key={r.profile.user_id}
                    className={
                      "border-t border-zinc-100 " + (isMe ? "bg-info-light/60" : "bg-white")
                    }
                  >
                    <td className="px-3 py-2 font-oswald text-zinc-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-medium">
                        <Avatar
                          displayName={r.profile.display_name}
                          initials={r.profile.initials}
                          avatarUrl={avatarUrlFor(r.profile.display_name)}
                          size={24}
                        />
                        <span className="truncate">{r.profile.display_name}</span>
                        {isMe && (
                          <span className="bg-info-light text-info-fg rounded px-1.5 text-[10px] font-bold uppercase">
                            tú
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-oswald text-zinc-600">{fmt(r.real)}</td>
                    <td className="px-3 py-2 text-right font-oswald text-zinc-600">{fmt(r.fair)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100 sm:block">
                          <div
                            className={
                              "h-full rounded-full " +
                              (harmed ? "bg-danger" : benefited ? "bg-success" : "bg-zinc-300")
                            }
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span
                          className={
                            "font-oswald inline-flex items-center gap-1 font-bold whitespace-nowrap " +
                            (harmed
                              ? "text-danger-fg"
                              : benefited
                                ? "text-success-fg"
                                : "text-zinc-500")
                          }
                        >
                          {harmed ? (
                            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                          ) : benefited ? (
                            <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {r.diff > 0 ? `+${fmt(r.diff)}` : fmt(r.diff)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-500">
        Diferencia positiva (rojo, ▲) = la Porra Justa le daría más puntos → perjudicado por los
        goles tardíos. Diferencia negativa (verde, ▼) = se benefició de esos goles. Las predicciones
        iniciales y los clasificados de grupo se cuentan igual en ambas porras, así que no afectan a
        la diferencia.
      </p>
    </main>
  );
}
