import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { loadLeaderboardData, buildGeneralRanking } from "@/lib/scoring/leaderboard";
import { ClasificacionTabs } from "./Tabs";

export default async function ClasificacionPage() {
  const { userId } = await requireAuth();
  const tournament = await getDefaultTournament();
  const data = await loadLeaderboardData(tournament.id);
  const ranking = buildGeneralRanking(data);

  const hasAnyScore = ranking.some((r) => r.total > 0);

  return (
    <main className="mx-auto max-w-4xl p-10">
      <h1 className="text-2xl font-bold">Clasificación</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Quién va por delante en la porra. Los puntos se actualizan al confirmar el resultado de cada
        partido.
      </p>

      <ClasificacionTabs active="general" />

      {!hasAnyScore ? (
        <p className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          Aún no hay puntuaciones. Las verás aquí cuando el admin confirme el primer resultado.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {ranking.map((row) => {
            const isMe = row.profile.user_id === userId;
            const cls =
              "rounded-md border p-3 flex items-center justify-between gap-3 " +
              (row.isTop
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                : row.isBottom
                  ? "border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900");
            return (
              <li key={row.profile.user_id} className={cls}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {row.position}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      {row.profile.display_name}{" "}
                      {isMe && (
                        <span className="ml-1 rounded bg-sky-100 px-1.5 text-xs font-medium text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                          tú
                        </span>
                      )}
                      {row.isTop && (
                        <span className="ml-1 text-emerald-700 dark:text-emerald-300">👑</span>
                      )}
                      {row.isBottom && (
                        <span className="ml-1 text-rose-700 dark:text-rose-300">🥲</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {row.profile.initials} ·{" "}
                      {row.profile.role === "admin" ? "admin" : "participante"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-bold">{row.total}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">puntos</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-8 rounded-md border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">¿Cómo se calcula?</h2>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Cada predicción acertada suma puntos: ganar o empatar (5), resultado exacto (10), cercanía
          de goles (1-3), diferencia exacta (3), prórroga (5), penaltis (5), equipo que pasa (8). En
          eliminatorias se aplica un multiplicador por ronda. Detalle en{" "}
          <Link href="/rules" className="underline">
            Reglas
          </Link>
          .
        </p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Para ver tu desglose personal,{" "}
          <Link href="/my-scores" className="underline">
            Mi puntuación
          </Link>
          . Para comparar predicciones por jornada, fase o partido, usa las pestañas.
        </p>
      </section>
    </main>
  );
}
