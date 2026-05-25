import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { loadLeaderboardData, buildEvolution } from "@/lib/scoring/leaderboard";
import { EvolutionChart } from "@/components/scoring/EvolutionChart";
import { ClasificacionTabs } from "../Tabs";

export default async function EvolucionPage() {
  await requireAuth();
  const tournament = await getDefaultTournament();
  const data = await loadLeaderboardData(tournament.id);
  const points = buildEvolution(data);

  return (
    <main className="mx-auto max-w-5xl p-10">
      <h1 className="text-2xl font-bold">Evolución de puntos</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Puntos acumulados de cada participante a lo largo del torneo. Las predicciones iniciales y
        los clasificados de grupo se aplican en la primera jornada con resultados.
      </p>

      <ClasificacionTabs active="evolucion" />

      <section className="mt-6 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <EvolutionChart
          points={points}
          users={data.profiles.map((p) => ({
            user_id: p.user_id,
            display_name: p.display_name,
            initials: p.initials,
          }))}
        />
      </section>
    </main>
  );
}
