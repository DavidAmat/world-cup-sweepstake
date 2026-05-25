"use client";

import { useState, useRef } from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { resetTournamentData } from "./actions";

type Table = {
  value: string;
  label: string;
  description: string;
};

const TABLES: Table[] = [
  {
    value: "initial_predictions",
    label: "Predicciones iniciales",
    description: "Campeón, subcampeón, pichichi y MVP.",
  },
  {
    value: "match_predictions",
    label: "Predicciones de partido",
    description: "Marcadores, prórroga, penaltis y equipo clasificado.",
  },
  {
    value: "group_qualification_predictions",
    label: "Clasificados de grupo",
    description: "Equipos seleccionados por grupo.",
  },
  {
    value: "match_results",
    label: "Resultados de partidos",
    description: "Marcadores confirmados y goles (match_results + match_goals).",
  },
  {
    value: "prediction_scores",
    label: "Puntuaciones calculadas",
    description: "prediction_scores: todos los puntos calculados por el motor.",
  },
  {
    value: "leaderboard_snapshots",
    label: "Snapshots de clasificación",
    description: "Instantáneas del leaderboard por jornada.",
  },
];

type Props = {
  tournamentId: string;
  tournamentName: string;
};

export function ResetModal({ tournamentId, tournamentName }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);

  function toggleTable(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(TABLES.map((t) => t.value)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function openModal() {
    if (selected.size === 0) return;
    setConfirmText("");
    setOpen(true);
  }

  const canSubmit = confirmText === "BORRAR" && selected.size > 0;

  return (
    <>
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="bg-danger-light flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Trash2 className="text-danger h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Datos a restablecer</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Torneo: <strong className="text-zinc-700">{tournamentName}</strong>. Selecciona qué
              tablas borrar. El master data (torneos, equipos, fixtures, reglas) no se toca nunca.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3 text-xs">
          <button
            type="button"
            onClick={selectAll}
            className="text-primary font-medium hover:underline"
          >
            Seleccionar todo
          </button>
          <span className="text-zinc-300">|</span>
          <button
            type="button"
            onClick={selectNone}
            className="font-medium text-zinc-500 hover:underline"
          >
            Deseleccionar todo
          </button>
        </div>

        <ul className="mt-3 space-y-2">
          {TABLES.map((t) => (
            <li key={t.value}>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 hover:border-zinc-300 hover:bg-zinc-100">
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 h-4 w-4 rounded"
                  checked={selected.has(t.value)}
                  onChange={() => toggleTable(t.value)}
                />
                <div>
                  <p className="text-sm font-medium text-zinc-800">{t.label}</p>
                  <p className="text-xs text-zinc-500">{t.description}</p>
                </div>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={openModal}
            disabled={selected.size === 0}
            className="bg-danger focus-visible:ring-danger flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Restablecer datos seleccionados
          </button>
        </div>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-danger-light flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <AlertTriangle className="text-danger h-4 w-4" aria-hidden="true" />
                </div>
                <h2 id="reset-modal-title" className="text-base font-bold text-zinc-900">
                  Confirmar borrado permanente
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="focus-visible:ring-primary rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-4 text-sm text-zinc-600">
              Estás a punto de borrar permanentemente{" "}
              <strong className="text-zinc-900">{selected.size} tabla(s)</strong> del torneo{" "}
              <strong className="text-zinc-900">{tournamentName}</strong>. Esta acción no se puede
              deshacer.
            </p>

            <ul className="bg-danger-light text-danger-fg mt-3 space-y-1 rounded-md px-4 py-3 text-xs">
              {TABLES.filter((t) => selected.has(t.value)).map((t) => (
                <li key={t.value} className="flex items-center gap-2">
                  <span className="bg-danger h-1 w-1 rounded-full" aria-hidden="true" />
                  {t.label}
                </li>
              ))}
            </ul>

            <p className="mt-4 text-sm font-medium text-zinc-700">
              Escribe <strong>BORRAR</strong> para confirmar:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="BORRAR"
              autoFocus
              autoComplete="off"
              className="focus:border-danger focus:ring-danger-light mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm tracking-widest outline-none focus:ring-2"
            />

            <form ref={formRef} action={resetTournamentData} className="mt-5 flex gap-3">
              <input type="hidden" name="tournament_id" value={tournamentId} />
              <input type="hidden" name="confirm" value={confirmText} />
              {Array.from(selected).map((v) => (
                <input key={v} type="hidden" name="tables[]" value={v} />
              ))}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="focus-visible:ring-primary flex-1 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:outline-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="bg-danger focus-visible:ring-danger flex-1 rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirmar borrado
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
