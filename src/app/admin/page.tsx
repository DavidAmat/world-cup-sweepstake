import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/requireAdmin";

export default async function AdminPage() {
  const { profile } = await requireAdmin();

  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-bold">Administración</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Hola {profile.display_name}. Desde aquí gestionas el torneo.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/fixtures"
          className="rounded-md border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          <h2 className="text-sm font-semibold">Fixtures</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Ver, editar y crear partidos. Importar eliminatorias en lote desde JSON.
          </p>
        </Link>
        <Link
          href="/admin/results"
          className="rounded-md border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          <h2 className="text-sm font-semibold">Resultados</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Introducir marcadores, prórroga, penaltis y goleadores. Confirmar para recalcular.
          </p>
        </Link>
        <Link
          href="/admin/reset"
          className="rounded-md border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          <h2 className="text-sm font-semibold">Reset de datos</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Borra predicciones, resultados y puntuaciones de prueba. El master data nunca se toca.
          </p>
        </Link>
        <Link
          href="/admin/reglas"
          className="rounded-md border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          <h2 className="text-sm font-semibold">Reglas de puntuación</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Versiona, activa y recalcula las reglas del motor de puntuación por torneo.
          </p>
        </Link>
        <Link
          href="/admin/evaluaciones"
          className="rounded-md border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          <h2 className="text-sm font-semibold">Evaluaciones subjetivas</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Marca a mano qué participantes acertaron el pichichi y el mejor jugador del torneo.
          </p>
        </Link>
        <Link
          href="/admin/users"
          className="rounded-md border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          <h2 className="text-sm font-semibold">Usuarios</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Participantes (nombre, email, avatar) y registro de accesos por hora de Madrid.
          </p>
        </Link>
        <Link
          href="/admin/standings"
          className="rounded-md border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          <h2 className="text-sm font-semibold">Clasificación de grupos</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Tabla en vivo de cada grupo y ranking de los mejores terceros que pasan a la fase final.
          </p>
        </Link>
      </section>
    </main>
  );
}
