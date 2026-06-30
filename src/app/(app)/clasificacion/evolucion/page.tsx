import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { loadLeaderboardData, buildEvolution } from "@/lib/scoring/leaderboard";
import { avatarUrlFor } from "@/lib/profiles/avatars";
import { EVOLUTION_COLORS } from "@/components/scoring/EvolutionChart";
import { EvolutionExplorer } from "@/components/scoring/EvolutionExplorer";
import { ClasificacionTabs } from "../Tabs";

export default async function EvolucionPage() {
  await requireAuth();
  const tournament = await getDefaultTournament();
  const data = await loadLeaderboardData(tournament.id);
  const points = buildEvolution(data);

  // Assign each participant a stable colour from the full roster so the line
  // colour stays the same no matter which subset the viewer plots.
  const users = data.profiles.map((p, i) => ({
    user_id: p.user_id,
    display_name: p.display_name,
    initials: p.initials,
    avatarUrl: avatarUrlFor(p.display_name),
    color: EVOLUTION_COLORS[i % EVOLUTION_COLORS.length],
  }));

  return (
    <main className="mx-auto max-w-7xl p-10">
      <h1 className="text-2xl font-bold">Evolución de puntos</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Puntos acumulados de cada participante día a día. Cada fecha suma los puntos de los partidos
        jugados hasta ese momento; el gráfico llega hasta el último día con resultados. Las
        predicciones iniciales y los clasificados de grupo se aplican el primer día. Pasa el cursor
        por un punto para ver su valor.
      </p>

      <ClasificacionTabs active="evolucion" />

      <section className="mt-6 rounded-md border border-zinc-200 bg-white p-4">
        <EvolutionExplorer points={points} users={users} />
      </section>
    </main>
  );
}
