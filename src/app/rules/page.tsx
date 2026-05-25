import Link from "next/link";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { acceptTerms } from "./actions";
import { CheckCircle2, ListChecks, ClipboardList, Lock } from "lucide-react";

type SearchParams = Promise<{ error?: string; ok?: string }>;

export default async function RulesPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, ok } = await searchParams;
  const { userId, supabase } = await requireAuth();

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
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Normas y puntuación</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Lee las reglas y acepta antes de empezar a jugar.
        </p>
      </div>

      {/* Step-by-step guide */}
      <section className="mb-6 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-zinc-800">Cómo funciona</h2>

        <div className="border-primary/20 bg-primary/5 flex gap-4 rounded-2xl border p-5">
          <div className="bg-primary/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <ListChecks className="text-primary h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Paso 1 — Predicciones iniciales</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Antes de que empiece el torneo, define: <strong>campeón</strong>,{" "}
              <strong>subcampeón</strong>, <strong>pichichi</strong>, <strong>mejor jugador</strong>{" "}
              y <strong>2 equipos que pasan por cada grupo</strong> (12 grupos, 24 clasificados en
              total).
            </p>
            <p className="mt-2 text-xs text-zinc-500 italic">
              Ejemplo: Campeón → Brasil · Pichichi → Mbappé · Grupo A pasan → Argentina y Marruecos
            </p>
          </div>
        </div>

        <div className="border-success/20 bg-success/5 flex gap-4 rounded-2xl border p-5">
          <div className="bg-success/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <ClipboardList className="text-success-fg h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Paso 2 — Predicciones de partidos</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Antes de cada jornada (el admin bloquea con ≥24h de antelación), predice el{" "}
              <strong>marcador a 90&apos;</strong> de cada partido. En eliminatorias, además indica
              si habrá <strong>prórroga</strong>, si habrá <strong>penaltis</strong> y qué{" "}
              <strong>equipo pasa</strong>.
            </p>
            <p className="mt-2 text-xs text-zinc-500 italic">
              Ejemplo: España 2 – 1 Francia · Sin prórroga
            </p>
            <p className="mt-1 text-xs text-zinc-500 italic">
              Ejemplo eliminatoria: Brasil 1 – 1 Portugal · Prórroga → Penaltis → Pasa Brasil
            </p>
          </div>
        </div>

        <div className="border-warning/20 bg-warning/5 flex gap-4 rounded-2xl border p-5">
          <div className="bg-warning/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Lock className="text-warning-fg h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Bloqueos y visibilidad</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Mientras una jornada esté <strong>abierta</strong>, solo tú ves tus predicciones. En
              cuanto el admin la <strong>bloquea</strong>, quedan congeladas y se hacen públicas
              para todos. Si no has predicho antes del bloqueo, ese partido cuenta como 0 puntos.
            </p>
          </div>
        </div>
      </section>

      {/* Scoring summary */}
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm">
        <h2 className="mb-3 font-semibold text-zinc-800">Sistema de puntuación (resumen)</h2>
        <div className="grid gap-y-1.5 text-xs text-zinc-600 sm:grid-cols-2">
          {[
            ["Ganador o empate a 90′", "5 pts"],
            ["Resultado exacto a 90′", "10 pts"],
            ["Cercanía de goles (±1)", "1–3 pts"],
            ["Diferencia exacta de goles", "3 pts"],
            ["Prórroga acertada", "5 pts"],
            ["Penaltis acertados", "5 pts"],
            ["Equipo que pasa acertado", "8 pts"],
            ["Campeón acertado", "10 pts"],
            ["Subcampeón acertado", "5 pts"],
          ].map(([label, pts]) => (
            <div key={label} className="flex justify-between gap-4 pr-4">
              <span>{label}</span>
              <span className="font-semibold text-zinc-800">{pts}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          En eliminatorias se aplica un multiplicador por ronda (×2 en R32, hasta ×5 en la final).
          Detalle completo en{" "}
          <Link href="/clasificacion" className="underline">
            Clasificación
          </Link>
          .
        </p>
      </section>

      {/* Feedback banners */}
      {error && (
        <p className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <div className="border-success/30 bg-success/10 text-success-fg mb-4 flex items-center gap-3 rounded-xl border p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>
            ¡Normas aceptadas! Ya puedes jugar. Vuelve al{" "}
            <Link href="/" className="font-medium underline">
              inicio
            </Link>
            .
          </span>
        </div>
      )}

      {/* Accept section */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        {!activeTournament ? (
          <p className="text-sm text-zinc-500">
            Aún no hay torneo activo. El administrador lo activará pronto.
          </p>
        ) : alreadyAccepted ? (
          <div className="text-success-fg flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Ya aceptaste las normas para <strong>{activeTournament.name}</strong>.{" "}
              <Link href="/" className="font-medium underline">
                Ir al inicio →
              </Link>
            </span>
          </div>
        ) : (
          <form action={acceptTerms}>
            <input type="hidden" name="tournamentId" value={activeTournament.id} />
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="confirmed"
                required
                className="accent-primary mt-0.5 h-4 w-4 rounded border-zinc-300"
              />
              <span className="text-sm leading-relaxed text-zinc-700">
                He leído y acepto las normas de la porra del{" "}
                <strong>{activeTournament.name}</strong>. Entiendo cómo funciona el sistema de
                predicciones y puntuación.
              </span>
            </label>
            <button
              type="submit"
              className="bg-primary mt-4 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90"
            >
              Acepto las normas y empiezo a jugar
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
