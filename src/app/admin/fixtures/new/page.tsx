import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { createFixture } from "../actions";

type SearchParams = Promise<{ error?: string }>;

export default async function NewFixturePage({ searchParams }: { searchParams: SearchParams }) {
  const { error: errMsg } = await searchParams;
  const { supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();

  const [stagesRes, roundsRes, teamsRes] = await Promise.all([
    supabase
      .from("stages")
      .select("id, code, name, sort_order")
      .eq("tournament_id", tournament.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("rounds")
      .select("id, code, name, stage_id, sort_order")
      .eq("tournament_id", tournament.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("teams")
      .select("id, code, display_name, group_code")
      .eq("tournament_id", tournament.id)
      .order("display_name", { ascending: true }),
  ]);

  const stages = stagesRes.data ?? [];
  const rounds = roundsRes.data ?? [];
  const teams = teamsRes.data ?? [];
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));

  return (
    <main className="mx-auto max-w-3xl p-10">
      <p className="text-xs text-zinc-500">
        <Link href="/admin/fixtures" className="underline">
          Fixtures
        </Link>{" "}
        / Nuevo
      </p>
      <h1 className="mt-1 text-2xl font-bold">Nuevo fixture</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Pensado para crear fixtures de eliminatorias uno a uno. Para añadir varios a la vez, usa{" "}
        <Link href="/admin/fixtures/import" className="underline">
          Importar JSON
        </Link>
        .
      </p>

      {errMsg && <ErrorBanner message={errMsg} className="mt-4" />}

      <form action={createFixture} className="mt-6 flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">external_id</span>
          <input
            type="text"
            name="external_id"
            required
            placeholder="wc2026_r16_001"
            pattern="[a-z0-9_-]+"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm"
          />
          <span className="text-xs text-zinc-500">
            Patrón sugerido: <code>wc2026_&lt;round&gt;_NNN</code> (round ∈ r32, r16, qf, sf, third,
            final). Debe ser único en el torneo y no se podrá editar luego.
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Fase</span>
            <select
              name="stage_id"
              required
              defaultValue=""
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Elige una fase
              </option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Jornada/Ronda</span>
            <select
              name="round_id"
              required
              defaultValue=""
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Elige una ronda
              </option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {stageNameById.get(r.stage_id) ?? "?"}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">
              Debe pertenecer a la fase elegida; el servidor lo valida.
            </span>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Grupo (opcional)</span>
          <input
            type="text"
            name="group_code"
            maxLength={1}
            pattern="[A-L]"
            placeholder="A–L (vacío para eliminatorias)"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="rounded-md border border-zinc-200 p-4">
          <legend className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Equipo local
          </legend>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Equipo</span>
            <select
              name="home_team_id"
              defaultValue=""
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— (usar placeholder)</option>
              {teams.map((t) => (
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
              placeholder="p.ej. Ganador A"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
            <span className="text-xs text-zinc-500">Solo se usa si dejas el equipo en blanco.</span>
          </label>
        </fieldset>

        <fieldset className="rounded-md border border-zinc-200 p-4">
          <legend className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Equipo visitante
          </legend>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Equipo</span>
            <select
              name="away_team_id"
              defaultValue=""
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— (usar placeholder)</option>
              {teams.map((t) => (
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
              placeholder="p.ej. 2.º Grupo C"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
            <span className="text-xs text-zinc-500">Solo se usa si dejas el equipo en blanco.</span>
          </label>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Kickoff (hora local Madrid)</span>
          <input
            type="datetime-local"
            name="kickoff_at"
            required
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Sede</span>
          <input
            type="text"
            name="venue"
            placeholder="Opcional"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Estado</span>
          <select
            name="status"
            defaultValue="scheduled"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="scheduled">Programado</option>
            <option value="locked">Bloqueado</option>
            <option value="completed">Finalizado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90"
          >
            Crear fixture
          </button>
          <Link
            href="/admin/fixtures"
            className="text-sm text-zinc-600 underline hover:text-zinc-900"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
