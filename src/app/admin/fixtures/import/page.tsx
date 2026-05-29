import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { ImportClient } from "./ImportClient";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type SearchParams = Promise<{ error?: string }>;

export default async function ImportFixturesPage({ searchParams }: { searchParams: SearchParams }) {
  const { error: errMsg } = await searchParams;
  await requireAdmin();
  const tournament = await getDefaultTournament();

  return (
    <main className="mx-auto max-w-4xl p-10">
      <p className="text-xs text-zinc-500">
        <Link href="/admin/fixtures" className="underline">
          Fixtures
        </Link>{" "}
        / Importar JSON
      </p>
      <h1 className="mt-1 text-2xl font-bold">Importar fixtures</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Pega un array JSON con N fixtures generado por ChatGPT siguiendo el prompt en{" "}
        <code>documentation/implementations/admin-fixtures-json-import.md</code>. Torneo destino:{" "}
        <strong>{tournament.name}</strong>.
      </p>

      {errMsg && <ErrorBanner message={errMsg} className="mt-4" />}

      <ImportClient />

      <details className="mt-8 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Formato esperado</summary>
        <pre className="mt-3 overflow-x-auto rounded-md bg-white p-3 text-xs leading-relaxed">
          {`[
  {
    "external_id": "wc2026_r16_001",
    "fase": "octavos",
    "tipo_partido": "eliminatoria",
    "jornada": null,
    "grupo": null,
    "equipo_1": "Países Bajos",
    "equipo_2": "Estados Unidos",
    "fecha": "2026-06-29T16:00:00",
    "venue": null
  }
]`}
        </pre>
        <ul className="mt-3 list-inside list-disc space-y-1 text-zinc-600">
          <li>
            <code>fase</code> ∈{" "}
            <code>fase_grupos | octavos | cuartos | semis | tercer_puesto | final</code>.
          </li>
          <li>
            <code>fecha</code> en hora local Madrid sin TZ (<code>YYYY-MM-DDTHH:MM:SS</code>).
          </li>
          <li>
            <code>equipo_1</code>/<code>equipo_2</code>: nombre canónico (<em>display_name</em>,
            <em> canonical_name</em> o alias). Si no resuelve y parece un placeholder
            (&laquo;Ganador A&raquo;, &laquo;2.º Grupo C&raquo;), se acepta como{" "}
            <code>placeholder</code>.
          </li>
          <li>
            La key estable es <code>external_id</code>: si ya existe, se actualiza el fixture; si
            no, se crea.
          </li>
        </ul>
      </details>
    </main>
  );
}
