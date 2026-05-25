import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { ResetModal } from "./ResetModal";

type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function AdminResetPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const tournament = await getDefaultTournament();
  const params = await searchParams;

  return (
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Reset de datos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Borra datos de prueba de un torneo. El master data y las reglas de puntuación nunca se
            modifican desde aquí.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-zinc-500 underline hover:text-zinc-900">
          ← Volver a administración
        </Link>
      </div>

      {params.ok === "reset" && (
        <div
          role="alert"
          className="border-success-light bg-success-light text-success-fg mt-5 rounded-md border px-4 py-3 text-sm font-medium"
        >
          Datos restablecidos correctamente.
        </div>
      )}
      {params.error && (
        <div
          role="alert"
          className="border-danger-light bg-danger-light text-danger-fg mt-5 rounded-md border px-4 py-3 text-sm font-medium"
        >
          {decodeURIComponent(params.error)}
        </div>
      )}

      <div className="border-warning-light bg-warning-light text-warning-fg mt-6 rounded-lg border px-4 py-3 text-sm">
        <strong>Atención:</strong> esta operación es irreversible. Los datos borrados no se pueden
        recuperar. Úsala solo en entornos de prueba o para reiniciar el torneo antes del inicio
        oficial.
      </div>

      <ResetModal tournamentId={tournament.id} tournamentName={tournament.name} />
    </main>
  );
}
