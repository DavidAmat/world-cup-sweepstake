import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/requireAdmin";

export default async function AdminPage() {
  const { profile } = await requireAdmin();

  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-bold">Administración</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Hola {profile.display_name}. Desde aquí gestionas el torneo.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/fixtures"
          className="rounded-md border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60"
        >
          <h2 className="text-sm font-semibold">Fixtures</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Ver, editar y crear partidos. Importar eliminatorias en lote desde JSON.
          </p>
        </Link>
        <div className="rounded-md border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
          <h2 className="font-semibold">Próximamente</h2>
          <p className="mt-1 text-xs">
            Resultados, reglas de puntuación y reset de datos de prueba (hitos 10, 11 y 14).
          </p>
        </div>
      </section>
    </main>
  );
}
