import Link from "next/link";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { FixtureStatusBadge } from "@/components/ui/Badge";
import { ROUNDS } from "@/lib/fixtures/catalogs";

const STATUS_VALUES = ["scheduled", "locked", "completed", "cancelled"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

type RoundFilter = (typeof ROUNDS)[number]["code"];

type SearchParams = Promise<{ round?: string; status?: string; ok?: string }>;

const LOCK_WINDOW_MS = 24 * 60 * 60 * 1000;

export default async function AdminFixturesPage({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // unblock Date.now() for the lockedByKickoff tally
  const { supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();
  const params = await searchParams;

  const roundFilter = ROUNDS.find((r) => r.code === params.round)?.code as RoundFilter | undefined;
  const statusFilter = STATUS_VALUES.includes(params.status as StatusFilter)
    ? (params.status as StatusFilter)
    : undefined;

  let query = supabase
    .from("fixtures")
    .select(
      `
        id,
        external_id,
        kickoff_at,
        status,
        group_code,
        venue,
        home_placeholder,
        away_placeholder,
        home_team:teams!fixtures_home_team_id_fkey ( id, code, display_name ),
        away_team:teams!fixtures_away_team_id_fkey ( id, code, display_name ),
        stage:stages ( id, code, name, sort_order ),
        round:rounds ( id, code, name, sort_order )
      `,
    )
    .eq("tournament_id", tournament.id)
    .order("kickoff_at", { ascending: true });

  if (statusFilter) query = query.eq("status", statusFilter);
  if (roundFilter) {
    const round = await supabase
      .from("rounds")
      .select("id")
      .eq("tournament_id", tournament.id)
      .eq("code", roundFilter)
      .maybeSingle();
    if (round.data) query = query.eq("round_id", round.data.id);
  }

  const { data: fixtures, error } = await query;
  if (error) {
    throw new Error(`Failed to load fixtures: ${error.message}`);
  }
  const rows = fixtures ?? [];

  // Counters use the full set, not the filtered one — they describe the
  // tournament, not the current view.
  const { data: allForCounts } = await supabase
    .from("fixtures")
    .select("status, kickoff_at")
    .eq("tournament_id", tournament.id);

  const counts = {
    total: allForCounts?.length ?? 0,
    scheduled: 0,
    locked: 0,
    completed: 0,
    cancelled: 0,
    lockedByKickoff: 0,
  };
  // eslint-disable-next-line react-hooks/purity -- request-scoped; connection() above forces dynamic render
  const now = Date.now();
  for (const f of allForCounts ?? []) {
    if (f.status in counts) {
      counts[f.status as keyof typeof counts] =
        (counts[f.status as keyof typeof counts] as number) + 1;
    }
    const kickoffMs = new Date(f.kickoff_at).getTime();
    if (now >= kickoffMs - LOCK_WINDOW_MS) counts.lockedByKickoff++;
  }

  return (
    <main className="mx-auto max-w-5xl p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fixtures</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Torneo: <strong>{tournament.name}</strong>. {counts.total} fixtures · {counts.scheduled}{" "}
            programados · {counts.completed} finalizados · {counts.cancelled} cancelados ·{" "}
            <span className="text-warning-fg">{counts.lockedByKickoff} bloqueados ahora</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/fixtures/import"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Importar JSON
          </Link>
          <Link
            href="/admin/fixtures/new"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
          >
            Nuevo fixture
          </Link>
        </div>
      </div>

      {params.ok === "created" && (
        <p className="border-success-light bg-success-light text-success-fg mt-4 rounded-md border p-3 text-sm">
          Fixture creado correctamente.
        </p>
      )}
      {params.ok === "updated" && (
        <p className="border-success-light bg-success-light text-success-fg mt-4 rounded-md border p-3 text-sm">
          Cambios guardados.
        </p>
      )}
      {params.ok?.startsWith("imported:") && (
        <p className="border-success-light bg-success-light text-success-fg mt-4 rounded-md border p-3 text-sm">
          Importación completada · {params.ok.slice("imported:".length)}
        </p>
      )}

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Ronda</span>
          <select
            name="round"
            defaultValue={roundFilter ?? ""}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {ROUNDS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Estado</span>
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="scheduled">Programado</option>
            <option value="locked">Bloqueado</option>
            <option value="completed">Finalizado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Filtrar
        </button>
        {(roundFilter || statusFilter) && (
          <Link
            href="/admin/fixtures"
            className="text-sm text-zinc-600 underline hover:text-zinc-900"
          >
            Limpiar
          </Link>
        )}
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <th className="py-2 pr-3">Ronda</th>
              <th className="py-2 pr-3">external_id</th>
              <th className="py-2 pr-3">Partido</th>
              <th className="py-2 pr-3">Fecha (Madrid)</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-500">
                  No hay fixtures que cumplan el filtro.
                </td>
              </tr>
            ) : (
              rows.map((f) => {
                const home = f.home_team?.display_name;
                const away = f.away_team?.display_name;
                const homeLabel = home ?? (
                  <span className="text-zinc-400 italic">{f.home_placeholder ?? "—"}</span>
                );
                const awayLabel = away ?? (
                  <span className="text-zinc-400 italic">{f.away_placeholder ?? "—"}</span>
                );
                return (
                  <tr key={f.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="py-2 pr-3">
                      {f.round?.name}
                      {f.group_code && (
                        <span className="ml-1 text-xs text-zinc-500">· Gr. {f.group_code}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      <Link
                        href={`/admin/fixtures/${f.id}`}
                        className="text-zinc-700 underline hover:text-zinc-900"
                      >
                        {f.external_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {homeLabel} <span className="text-zinc-400">vs</span> {awayLabel}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatMadridDateTime(f.kickoff_at)}
                    </td>
                    <td className="py-2 pr-3">
                      <FixtureStatusBadge status={f.status} />
                    </td>
                    <td className="py-2 pr-3">
                      <Link
                        href={`/admin/fixtures/${f.id}`}
                        className="text-sm text-zinc-600 underline hover:text-zinc-900"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        Mostrando {rows.length} fixture(s) {roundFilter || statusFilter ? "filtrados" : "totales"}.
        Las fechas se muestran en horario Madrid (CET/CEST).
      </p>
    </main>
  );
}
