import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { DEFAULT_SCORING_RULES_V1 } from "@/lib/scoring/rules";
import type { ScoringRulesV1 } from "@/lib/scoring/types";
import { RulesEditor } from "./RulesEditor";
import { duplicateScoringRules, activateScoringRules, recalculateScoringRules } from "./actions";

type SearchParams = Promise<{ ok?: string; error?: string; editing?: string }>;

export default async function AdminReglasPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const tournament = await getDefaultTournament();
  const params = await searchParams;
  const supabase = createAdminClient();

  const { data: allRules } = await supabase
    .from("scoring_rules")
    .select("id, version, active, rules, created_at")
    .eq("tournament_id", tournament.id)
    .order("version", { ascending: false });

  const rules = allRules ?? [];
  const editingId = params.editing ?? null;

  return (
    <main className="mx-auto max-w-3xl p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Reglas de puntuación</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Torneo: <strong className="text-zinc-700">{tournament.name}</strong>. Versiona, activa y
            recalcula las reglas del motor de puntuación.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-zinc-500 underline hover:text-zinc-900">
          ← Volver a administración
        </Link>
      </div>

      {params.ok === "saved" && (
        <div
          role="alert"
          className="border-success-light bg-success-light text-success-fg mt-5 rounded-md border px-4 py-3 text-sm font-medium"
        >
          Borrador guardado correctamente.
        </div>
      )}
      {params.ok === "activated" && (
        <div
          role="alert"
          className="border-primary-light bg-primary-light text-primary mt-5 rounded-md border px-4 py-3 text-sm font-medium"
        >
          Versión activada. Recalcula las puntuaciones para aplicarla.
        </div>
      )}
      {params.ok === "recalculated" && (
        <div
          role="alert"
          className="border-success-light bg-success-light text-success-fg mt-5 rounded-md border px-4 py-3 text-sm font-medium"
        >
          Puntuaciones recalculadas con la versión activa.
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

      {rules.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No hay versiones de reglas para este torneo.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {rules.map((r) => {
            const isEditing = editingId === r.id;
            const rulesObj = (r.rules as ScoringRulesV1 | null) ?? DEFAULT_SCORING_RULES_V1;

            return (
              <li key={r.id} className="rounded-lg border border-zinc-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs font-semibold text-zinc-700">
                      v{r.version}
                    </span>
                    {r.active ? (
                      <span className="bg-success-light text-success-fg rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        Activa
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                        Borrador
                      </span>
                    )}
                    <span className="text-xs text-zinc-400">
                      {formatMadridDateTime(r.created_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form action={duplicateScoringRules}>
                      <input type="hidden" name="source_id" value={r.id} />
                      <button
                        type="submit"
                        className="focus-visible:ring-primary rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:outline-none"
                      >
                        Duplicar y editar
                      </button>
                    </form>

                    {!r.active && (
                      <Link
                        href={isEditing ? `/admin/reglas` : `/admin/reglas?editing=${r.id}`}
                        className="border-primary-light bg-primary-light text-primary focus-visible:ring-primary rounded-md border px-3 py-1.5 text-xs font-medium hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {isEditing ? "Cerrar editor" : "Editar borrador"}
                      </Link>
                    )}

                    {!r.active && (
                      <form action={activateScoringRules}>
                        <input type="hidden" name="rule_id" value={r.id} />
                        <button
                          type="submit"
                          className="bg-primary text-primary-fg focus-visible:ring-primary rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
                        >
                          Activar esta versión
                        </button>
                      </form>
                    )}

                    {r.active && (
                      <form action={recalculateScoringRules}>
                        <button
                          type="submit"
                          className="border-special-light bg-special-light text-special focus-visible:ring-special rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
                        >
                          Recalcular ahora
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {isEditing && !r.active && (
                  <div className="border-t border-zinc-100 px-5 pb-5">
                    <RulesEditor ruleId={r.id} defaultValues={rulesObj} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
