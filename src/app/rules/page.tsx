import { requireAuth } from "@/lib/permissions/requireAuth";
import { acceptTerms } from "./actions";

type SearchParams = Promise<{ error?: string; ok?: string }>;

export default async function RulesPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, ok } = await searchParams;
  const { userId, supabase } = await requireAuth();

  // Active tournament (if any). Without one, the accept button is disabled —
  // there's nothing to attach the acceptance to yet.
  const { data: activeTournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let alreadyAccepted = false;
  if (activeTournament) {
    const { data: existing } = await supabase
      .from("terms_acceptances")
      .select("id")
      .eq("tournament_id", activeTournament.id)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    alreadyAccepted = !!existing;
  }

  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-bold">Normas y puntuación</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Versión preliminar. El sistema definitivo de puntos se publicará antes del primer partido.
      </p>

      <section className="mt-6 space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">Resumen del sistema</h2>
        <ul className="list-inside list-disc space-y-1 text-zinc-700 dark:text-zinc-300">
          <li>Cada partido se predice con resultado a 90 minutos.</li>
          <li>
            En eliminatorias, además, indicas si habrá prórroga, si habrá penaltis y qué equipo pasa
            de ronda.
          </li>
          <li>
            Aciertos puntúan en cascada: ganador, resultado exacto, cercanía de goles, diferencia, y
            multiplicador por fase (más en cuartos / semis / final).
          </li>
          <li>
            Predicciones iniciales (campeón, subcampeón, pichichi, mejor jugador, clasificados de
            grupos) puntúan al final del torneo.
          </li>
          <li>
            Las predicciones se bloquean 24 horas antes del partido y entonces se hacen públicas
            para todos.
          </li>
        </ul>
      </section>

      {error && (
        <p className="mt-6 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {ok && (
        <p className="mt-6 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          ¡Aceptación registrada! Ya puedes seguir.
        </p>
      )}

      <section className="mt-8">
        {!activeTournament ? (
          <p className="text-sm text-zinc-500">
            Aún no hay torneo activo. Cuando el administrador active el torneo, podrás aceptar las
            normas aquí.
          </p>
        ) : alreadyAccepted ? (
          <p className="text-sm text-zinc-500">
            Ya aceptaste las normas para <strong>{activeTournament.name}</strong>.
          </p>
        ) : (
          <form action={acceptTerms} className="flex flex-col gap-3">
            <input type="hidden" name="tournamentId" value={activeTournament.id} />
            <button
              type="submit"
              className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Acepto las normas
            </button>
            <p className="text-xs text-zinc-500">
              Para <strong>{activeTournament.name}</strong>. Se registrará la aceptación con fecha y
              hora.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
