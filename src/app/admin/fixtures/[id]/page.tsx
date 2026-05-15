import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { formatMadridDateTime, utcIsoToMadridInput } from "@/lib/dates/madridTime";
import { FixtureStatusBadge } from "@/components/ui/Badge";
import { updateFixture } from "../actions";

type RouteParams = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; ok?: string }>;

const LOCK_WINDOW_MS = 24 * 60 * 60 * 1000;

export default async function EditFixturePage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  await connection(); // unblock Date.now() for the lock-window warning
  const { id } = await params;
  const { error: errMsg, ok } = await searchParams;
  const { supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();

  const { data: fixture, error } = await supabase
    .from("fixtures")
    .select(
      `
        id,
        external_id,
        kickoff_at,
        status,
        group_code,
        venue,
        home_team_id,
        away_team_id,
        home_placeholder,
        away_placeholder,
        stage:stages ( id, code, name ),
        round:rounds ( id, code, name )
      `,
    )
    .eq("id", id)
    .eq("tournament_id", tournament.id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load fixture: ${error.message}`);
  if (!fixture) notFound();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, code, display_name, group_code")
    .eq("tournament_id", tournament.id)
    .order("display_name", { ascending: true });

  const kickoffMs = new Date(fixture.kickoff_at).getTime();
  // eslint-disable-next-line react-hooks/purity -- request-scoped; connection() above forces dynamic render
  const isLockedByKickoff = Date.now() >= kickoffMs - LOCK_WINDOW_MS;
  const isFinalState = fixture.status === "completed" || fixture.status === "cancelled";

  return (
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500">
            <Link href="/admin/fixtures" className="underline">
              Fixtures
            </Link>{" "}
            / {fixture.round?.name} {fixture.group_code ? `· Gr. ${fixture.group_code}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-bold">Editar fixture</h1>
          <p className="mt-1 font-mono text-xs text-zinc-500">{fixture.external_id}</p>
        </div>
        <FixtureStatusBadge status={fixture.status} />
      </div>

      {errMsg && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {errMsg}
        </p>
      )}
      {ok === "updated" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Cambios guardados.
        </p>
      )}
      {ok === "created" && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Fixture creado correctamente.
        </p>
      )}

      {isLockedByKickoff && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Este fixture ya está dentro de la ventana de bloqueo de 24h. Cambios en{" "}
          <code>kickoff_at</code> o equipos afectan a las predicciones que se hagan a partir de
          ahora.
        </p>
      )}
      {isFinalState && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Este fixture está en estado <strong>{fixture.status}</strong>. Edita con cuidado.
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 rounded-md border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="text-xs text-zinc-500">Fase</p>
          <p>{fixture.stage?.name}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Jornada/Ronda</p>
          <p>{fixture.round?.name}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Grupo</p>
          <p>{fixture.group_code ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Kickoff actual (Madrid)</p>
          <p>{formatMadridDateTime(fixture.kickoff_at)}</p>
        </div>
      </section>

      <form action={updateFixture} className="mt-6 flex flex-col gap-5">
        <input type="hidden" name="id" value={fixture.id} />

        <fieldset className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Equipo local
          </legend>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Equipo</span>
            <select
              name="home_team_id"
              defaultValue={fixture.home_team_id ?? ""}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— (usar placeholder)</option>
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.display_name} {t.group_code ? `· Gr. ${t.group_code}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="font-medium">Placeholder</span>
            <input
              type="text"
              name="home_placeholder"
              defaultValue={fixture.home_placeholder ?? ""}
              placeholder="p.ej. Ganador A"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <span className="text-xs text-zinc-500">Solo se usa si dejas el equipo en blanco.</span>
          </label>
        </fieldset>

        <fieldset className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Equipo visitante
          </legend>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Equipo</span>
            <select
              name="away_team_id"
              defaultValue={fixture.away_team_id ?? ""}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— (usar placeholder)</option>
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.display_name} {t.group_code ? `· Gr. ${t.group_code}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="font-medium">Placeholder</span>
            <input
              type="text"
              name="away_placeholder"
              defaultValue={fixture.away_placeholder ?? ""}
              placeholder="p.ej. 2.º Grupo C"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <span className="text-xs text-zinc-500">Solo se usa si dejas el equipo en blanco.</span>
          </label>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Kickoff (hora local Madrid)</span>
          <input
            type="datetime-local"
            name="kickoff_at"
            defaultValue={utcIsoToMadridInput(fixture.kickoff_at)}
            required
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Sede</span>
          <input
            type="text"
            name="venue"
            defaultValue={fixture.venue ?? ""}
            placeholder="Opcional"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Estado</span>
          <select
            name="status"
            defaultValue={fixture.status}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="scheduled">Programado</option>
            <option value="locked">Bloqueado</option>
            <option value="completed">Finalizado</option>
            <option value="cancelled">Cancelado</option>
          </select>
          <span className="text-xs text-zinc-500">
            Normalmente lo gestiona el sistema. El bloqueo por kickoff_at − 24h se evalúa
            dinámicamente, no por este campo.
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Guardar cambios
          </button>
          <Link
            href="/admin/fixtures"
            className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Cancelar
          </Link>
        </div>
      </form>

      <p className="mt-6 font-mono text-xs text-zinc-400">id: {fixture.id}</p>
    </main>
  );
}
