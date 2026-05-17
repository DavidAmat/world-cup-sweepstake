"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { saveAllMatchPredictions } from "./actions";

export type SavedVM = {
  h90: number;
  a90: number;
  et: boolean;
  pen: boolean;
  qual: string | null;
};

export type FixtureVM = {
  id: string;
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  kickoff: string;
  isKnockout: boolean;
  locked: boolean;
  noTeams: boolean;
  saved: SavedVM | null;
};

export type RoundVM = {
  code: string;
  name: string;
  fixtures: FixtureVM[];
};

type Values = { h90: string; a90: string; et: boolean; pen: boolean; qual: string };

const INPUT_CLS =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const GOAL_CLS = `${INPUT_CLS} w-16 text-center`;

function initial(f: FixtureVM): Values {
  const s = f.saved;
  // Extra time is derived, not stored UI state: a knockout draw at 90'
  // always implies extra time (kept consistent with the server rule).
  const et = !!s && f.isKnockout && s.h90 === s.a90;
  return {
    h90: s ? String(s.h90) : "",
    a90: s ? String(s.a90) : "",
    et,
    pen: et ? (s?.pen ?? false) : false,
    qual: s?.qual ?? "",
  };
}

function isSaved(v: Values, s: SavedVM | null): boolean {
  if (!s) return false;
  return (
    v.h90 === String(s.h90) &&
    v.a90 === String(s.a90) &&
    v.et === s.et &&
    v.pen === s.pen &&
    (v.qual || "") === (s.qual ?? "")
  );
}

export function MatchesForm({ rounds }: { rounds: RoundVM[] }) {
  const allFixtures = useMemo(() => rounds.flatMap((r) => r.fixtures), [rounds]);

  const [values, setValues] = useState<Record<string, Values>>(() => {
    const m: Record<string, Values> = {};
    for (const f of allFixtures) m[f.id] = initial(f);
    return m;
  });

  const knockoutById = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const f of allFixtures) m[f.id] = f.isKnockout;
    return m;
  }, [allFixtures]);

  const set = (id: string, patch: Partial<Values>) =>
    setValues((prev) => {
      const next = { ...prev[id], ...patch };
      // Extra time is automatic: a knockout fixture drawn at 90' always
      // goes to extra time; otherwise (or in the group stage) it never
      // does. The user does not toggle it. Penalties require extra time.
      const draw90 = next.h90 !== "" && next.a90 !== "" && next.h90 === next.a90;
      next.et = knockoutById[id] === true && draw90;
      if (!next.et) next.pen = false;
      return { ...prev, [id]: next };
    });

  const savedById = useMemo(() => {
    const m: Record<string, SavedVM | null> = {};
    for (const f of allFixtures) m[f.id] = f.saved;
    return m;
  }, [allFixtures]);

  const unsavedCount = allFixtures.filter(
    (f) => !f.locked && !f.noTeams && !isSaved(values[f.id], savedById[f.id]),
  ).length;

  return (
    <form action={saveAllMatchPredictions} className="mt-4">
      <div className="sticky top-0 z-10 -mx-10 border-b border-zinc-200 bg-white/90 px-10 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {unsavedCount === 0 ? (
              <span className="text-emerald-700 dark:text-emerald-300">Todo guardado ✓</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">
                {unsavedCount} partido{unsavedCount === 1 ? "" : "s"} sin guardar
              </span>
            )}
          </p>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Guardar predicciones
          </button>
        </div>
        <nav className="mt-2 flex flex-wrap gap-1.5">
          {rounds.map((r) => (
            <a
              key={r.code}
              href={`#r-${r.code}`}
              className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {r.name}
            </a>
          ))}
        </nav>
      </div>

      <div className="mt-4 flex flex-col gap-8">
        {rounds.map((r) => (
          <section key={r.code} id={`r-${r.code}`} className="scroll-mt-32">
            <h2 className="border-b-2 border-zinc-300 pb-1 text-lg font-bold dark:border-zinc-700">
              {r.name}
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {r.fixtures.map((f) => {
                const v = values[f.id];
                const status = f.locked ? "blocked" : isSaved(v, f.saved) ? "saved" : "unsaved";
                return (
                  <li
                    key={f.id}
                    className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="font-semibold">
                          {f.home} <span className="text-zinc-400">vs</span> {f.away}
                        </span>
                        <span className="ml-2 text-xs text-zinc-500">
                          {formatMadridDateTime(f.kickoff)} (Madrid)
                        </span>
                      </div>
                      {status === "blocked" ? (
                        <Badge tone="zinc">Bloqueado</Badge>
                      ) : status === "saved" ? (
                        <Badge tone="emerald">Guardado</Badge>
                      ) : (
                        <Badge tone="amber">Sin guardar</Badge>
                      )}
                    </div>

                    {f.noTeams ? (
                      <p className="mt-3 text-sm text-zinc-500">
                        ⏳ Equipos por definir — no se puede predecir todavía.
                      </p>
                    ) : f.locked ? (
                      <ReadOnly f={f} />
                    ) : (
                      <Editable f={f} v={v} set={set} />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Guardar predicciones
        </button>
        <span className="text-xs text-zinc-500">
          Guarda todas las jornadas a la vez. Cada partido editado vuelve a “Sin guardar” (amarillo)
          hasta que pulses Guardar.
        </span>
      </div>
    </form>
  );
}

function Editable({
  f,
  v,
  set,
}: {
  f: FixtureVM;
  v: Values;
  set: (id: string, patch: Partial<Values>) => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-40 truncate text-right">{f.home}</span>
        <input
          type="number"
          name={`h90_${f.id}`}
          min={0}
          value={v.h90}
          onChange={(e) => set(f.id, { h90: e.target.value })}
          className={GOAL_CLS}
          aria-label={`Goles ${f.home} a 90'`}
        />
        <span className="text-zinc-400">-</span>
        <input
          type="number"
          name={`a90_${f.id}`}
          min={0}
          value={v.a90}
          onChange={(e) => set(f.id, { a90: e.target.value })}
          className={GOAL_CLS}
          aria-label={`Goles ${f.away} a 90'`}
        />
        <span className="w-40 truncate">{f.away}</span>
      </div>

      {f.isKnockout && (
        <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="text-xs text-zinc-500">
            La prórroga es automática: si predices empate a 90&apos; en eliminatoria, hay prórroga.
            No se predice el resultado de la prórroga, solo si hay penaltis y qué equipo pasa.
          </p>
          {v.et && <input type="hidden" name={`et_${f.id}`} value="1" />}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={v.et}
              disabled
              readOnly
              className="h-4 w-4"
              aria-label="Habrá prórroga (automático)"
            />
            <span className={v.et ? "" : "text-zinc-400"}>
              Habrá prórroga {v.et ? "(empate a 90′ → sí)" : "(automático)"}
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name={`pen_${f.id}`}
              checked={v.pen}
              disabled={!v.et}
              onChange={(e) => set(f.id, { pen: e.target.checked })}
              className="h-4 w-4"
            />
            <span className={v.et ? "" : "text-zinc-400"}>Se decide en los penaltis</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Equipo que pasa</span>
            <select
              name={`qual_${f.id}`}
              value={v.qual}
              onChange={(e) => set(f.id, { qual: e.target.value })}
              className={INPUT_CLS}
            >
              <option value="">— Sin elegir —</option>
              <option value={f.homeId}>{f.home}</option>
              <option value={f.awayId}>{f.away}</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function ReadOnly({ f }: { f: FixtureVM }) {
  const s = f.saved;
  if (!s) {
    return <p className="mt-3 text-sm text-zinc-500">— sin predicción —</p>;
  }
  const qualified = s.qual === f.homeId ? f.home : s.qual === f.awayId ? f.away : "—";
  return (
    <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
      <p>
        90&apos;: <strong>{s.h90}</strong> - <strong>{s.a90}</strong>
      </p>
      {f.isKnockout && s.et && <p>Prórroga{s.pen ? " · penaltis" : ""}</p>}
      {f.isKnockout && <p className="text-zinc-500">Pasa: {qualified}</p>}
    </div>
  );
}
