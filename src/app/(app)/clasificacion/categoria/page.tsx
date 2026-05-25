import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { loadLeaderboardData, buildByCategory } from "@/lib/scoring/leaderboard";
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type CategoryBucket,
} from "@/lib/scoring/breakdownLabels";
import { ClasificacionTabs } from "../Tabs";
import { CategoriaTable } from "./CategoriaTable";

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
    <main className="mx-auto max-w-7xl p-10">
      <h1 className="text-2xl font-bold">Clasificación por categoría</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Cuánto pesan en el total de cada participante los aciertos por tipo: resultados de partido,
        eliminatorias (prórroga/penaltis/pasa), predicciones iniciales y clasificados de grupo.
      </p>

      <ClasificacionTabs active="categoria" />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat} className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
            <p className="font-semibold">{CATEGORY_LABELS[cat]}</p>
            <p className="mt-1 text-xs text-zinc-600">{CATEGORY_DESCRIPTIONS[cat]}</p>
          </div>
        ))}
      </section>

      {!hasScores ? (
        <p className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Aún no hay puntuaciones.
        </p>
      ) : (
        <CategoriaTable rows={rows} categoryOrder={CATEGORY_ORDER} userId={userId} />
      )}
    </main>
  );
}
