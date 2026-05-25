"use client";

import { useActionState } from "react";
import { commitImport, previewImport, type PreviewState } from "../actions";

const INITIAL_STATE: PreviewState = { ok: false };

function KindBadge({ kind }: { kind: "create" | "update" | "error" }) {
  const tone =
    kind === "create"
      ? "bg-success-light text-success-fg"
      : kind === "update"
        ? "bg-warning-light text-warning-fg"
        : "bg-danger-light text-danger-fg";
  const label = kind === "create" ? "nuevo" : kind === "update" ? "actualiza" : "error";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function ImportClient() {
  const [state, action, pending] = useActionState(previewImport, INITIAL_STATE);

  const report = state.report;
  const noErrors = report ? report.counts.error === 0 && report.counts.total > 0 : false;

  return (
    <div className="mt-6">
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">JSON</span>
          <textarea
            name="payload"
            required
            rows={14}
            placeholder='[ { "external_id": "wc2022_r16_001", "fase": "octavos", ... } ]'
            className="rounded-md border border-zinc-300 bg-white p-3 font-mono text-xs leading-relaxed"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {pending ? "Validando…" : "Validar y previsualizar"}
          </button>
          <button
            type="submit"
            formAction={commitImport}
            disabled={!noErrors || pending}
            className="border-success-light bg-success-light text-success-fg hover:bg-success-light rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Confirmar e insertar
          </button>
        </div>
      </form>

      {state.error && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {report && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Preview</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {report.counts.total} fila(s) · {report.counts.create} nuevas · {report.counts.update}{" "}
            actualizan · {report.counts.error} con error.
            {report.counts.error > 0 && (
              <span className="text-danger-fg ml-1">Corrige los errores antes de confirmar.</span>
            )}
          </p>
          <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-50 text-left text-xs tracking-wide text-zinc-500 uppercase">
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">external_id</th>
                  <th className="px-3 py-2">Partido</th>
                  <th className="px-3 py-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, idx) => (
                  <tr key={`${r.external_id}-${idx}`} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <KindBadge kind={r.kind} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.external_id}</td>
                    <td className="px-3 py-2">{r.summary}</td>
                    <td className="px-3 py-2 text-xs text-zinc-600">
                      {r.kind === "error"
                        ? r.reason
                        : `${r.row.kickoff_at} · ${r.row.home_placeholder ? `«${r.row.home_placeholder}»` : "team"} vs ${r.row.away_placeholder ? `«${r.row.away_placeholder}»` : "team"}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
