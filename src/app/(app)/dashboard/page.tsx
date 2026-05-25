import { requireAuth } from "@/lib/permissions/requireAuth";

export default async function DashboardPage() {
  const { userId, supabase } = await requireAuth();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("user_id", userId)
    .single();

  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-bold">Hola, {profile?.display_name ?? "jugador"}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Próximamente: resumen de tu porra, próximos partidos y posición en la clasificación.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href="/predictions/initial"
          className="rounded-md border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
        >
          <p className="font-semibold">Predicciones iniciales</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Campeón, subcampeón, pichichi, mejor jugador y clasificados de grupo.
          </p>
        </a>
        <a
          href="/predictions/initial/public"
          className="rounded-md border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
        >
          <p className="font-semibold">Vista pública</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Lo que predijo cada participante (al empezar el torneo).
          </p>
        </a>
        <a
          href="/predictions/matches"
          className="rounded-md border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
        >
          <p className="font-semibold">Predicciones de partidos</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Marcadores por jornada; prórroga y penaltis en eliminatorias.
          </p>
        </a>
        <a
          href="/predictions/matches/public"
          className="rounded-md border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
        >
          <p className="font-semibold">Partidos · vista pública</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Predicciones de cada partido una vez bloqueado.
          </p>
        </a>
        <a
          href="/clasificacion"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm hover:border-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30 dark:hover:border-emerald-600"
        >
          <p className="font-semibold">Clasificación</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Ranking general, por jornada, por fase y por categoría. Y un gráfico de evolución.
          </p>
        </a>
        <a
          href="/my-scores"
          className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm hover:border-sky-400 dark:border-sky-800 dark:bg-sky-950/30 dark:hover:border-sky-600"
        >
          <p className="font-semibold">Mi puntuación</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Tu desglose personal: barras horizontales por partido y detalle por criterio.
          </p>
        </a>
      </div>
      {profile?.role === "admin" && (
        <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-100 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          Tienes rol de administrador. Accede a{" "}
          <a href="/admin" className="underline">
            Administración
          </a>{" "}
          para gestionar el torneo.
        </p>
      )}
    </main>
  );
}
