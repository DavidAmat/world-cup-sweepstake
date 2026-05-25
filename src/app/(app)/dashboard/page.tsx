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
      <p className="mt-2 text-sm text-zinc-600">
        Próximamente: resumen de tu porra, próximos partidos y posición en la clasificación.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href="/predictions/initial"
          className="rounded-md border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-400"
        >
          <p className="font-semibold">Predicciones iniciales</p>
          <p className="mt-1 text-zinc-600">
            Campeón, subcampeón, pichichi, mejor jugador y clasificados de grupo.
          </p>
        </a>
        <a
          href="/predictions/initial/public"
          className="rounded-md border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-400"
        >
          <p className="font-semibold">Vista pública</p>
          <p className="mt-1 text-zinc-600">
            Lo que predijo cada participante (al empezar el torneo).
          </p>
        </a>
        <a
          href="/predictions/matches"
          className="rounded-md border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-400"
        >
          <p className="font-semibold">Predicciones de partidos</p>
          <p className="mt-1 text-zinc-600">
            Marcadores por jornada; prórroga y penaltis en eliminatorias.
          </p>
        </a>
        <a
          href="/predictions/matches/public"
          className="rounded-md border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-400"
        >
          <p className="font-semibold">Partidos · vista pública</p>
          <p className="mt-1 text-zinc-600">Predicciones de cada partido una vez bloqueado.</p>
        </a>
        <a
          href="/clasificacion"
          className="border-success-light bg-success-light hover:border-success rounded-md border p-4 text-sm"
        >
          <p className="font-semibold">Clasificación</p>
          <p className="mt-1 text-zinc-600">
            Ranking general, por jornada, por fase y por categoría. Y un gráfico de evolución.
          </p>
        </a>
        <a
          href="/my-scores"
          className="border-info-light bg-info-light hover:border-info rounded-md border p-4 text-sm"
        >
          <p className="font-semibold">Mi puntuación</p>
          <p className="mt-1 text-zinc-600">
            Tu desglose personal: barras horizontales por partido y detalle por criterio.
          </p>
        </a>
      </div>
      {profile?.role === "admin" && (
        <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-100 p-3 text-sm">
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
