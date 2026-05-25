import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { loadLeaderboardData, buildByCategory } from "@/lib/scoring/leaderboard";
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type CategoryBucket,
} from "@/lib/scoring/breakdownLabels";
import { ClasificacionTabs } from "../Tabs";

const CATEGORY_ORDER: CategoryBucket[] = [
  "match_outcome",
  "knockout_extra",
  "initial",
  "group_qualification",
];

export default async function CategoriaPage() {
  const { userId } = await requireAuth();
  const tournament = await getDefaultTournament();
  const data = await loadLeaderboardData(tournament.id);
  const rows = buildByCategory(data);

  const hasScores = rows.some((r) => r.total > 0);

  return (
    <main className="mx-auto max-w-5xl p-10">
      <h1 className="text-2xl font-bold">Clasificación por categoría</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Cuánto pesan en el total de cada participante los aciertos por tipo: resultados de partido,
        eliminatorias (prórroga/penaltis/pasa), predicciones iniciales y clasificados de grupo.
      </p>

      <ClasificacionTabs active="categoria" />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORY_ORDER.map((cat) => (
          <div
            key={cat}
            className="rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="font-semibold">{CATEGORY_LABELS[cat]}</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {CATEGORY_DESCRIPTIONS[cat]}
            </p>
          </div>
        ))}
      </section>

      {!hasScores ? (
        <p className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          Aún no hay puntuaciones.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="sticky left-0 bg-zinc-50 px-3 py-2 font-semibold dark:bg-zinc-900">
                  Participante
                </th>
                {CATEGORY_ORDER.map((cat) => (
                  <th key={cat} className="px-3 py-2 text-right font-semibold">
                    {CATEGORY_LABELS[cat]}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isMe = row.profile.user_id === userId;
                return (
                  <tr
                    key={row.profile.user_id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="sticky left-0 bg-white px-3 py-2 font-medium dark:bg-zinc-950">
                      {row.profile.display_name}
                      {isMe && (
                        <span className="ml-1 rounded bg-sky-100 px-1.5 text-xs font-medium text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                          tú
                        </span>
                      )}
                    </td>
                    {CATEGORY_ORDER.map((cat) => (
                      <td key={cat} className="px-3 py-2 text-right font-mono">
                        {row.byCategory[cat]}
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
