"use client";

import Link from "next/link";
import { useState } from "react";
import { TeamName } from "@/components/ui/TeamName";
import { BEST_THIRDS_ADVANCE } from "@/lib/scoring/scoreGroup";
import { MIN_QUALIFIERS, MAX_QUALIFIERS } from "./schemas";

type Group = { code: string; teams: { id: string; name: string }[] };

/**
 * Per-group clasificados picker. WC2026 rule: in exactly BEST_THIRDS_ADVANCE
 * (8) groups the user marks 3 teams (top 2 + the third they bet advances as a
 * best third); in the rest they mark 2. The checkboxes post `qual_<G>` exactly
 * like before, so the server action is unchanged; this component only enforces
 * the rule live and disables "Guardar" until it holds. The server re-validates.
 */
export function ClasificadosPicker({
  groups,
  initialSelected,
}: {
  groups: Group[];
  initialSelected: Record<string, string[]>;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of groups) init[g.code] = initialSelected[g.code] ?? [];
    return init;
  });

  function toggle(code: string, teamId: string) {
    setSelected((prev) => {
      const cur = prev[code] ?? [];
      if (cur.includes(teamId)) {
        return { ...prev, [code]: cur.filter((id) => id !== teamId) };
      }
      if (cur.length >= MAX_QUALIFIERS) return prev; // never more than 3
      return { ...prev, [code]: [...cur, teamId] };
    });
  }

  const counts = groups.map((g) => (selected[g.code] ?? []).length);
  const groupsWithThree = counts.filter((c) => c === MAX_QUALIFIERS).length;
  const everyGroupOk = counts.every((c) => c >= MIN_QUALIFIERS && c <= MAX_QUALIFIERS);
  const valid = everyGroupOk && groupsWithThree === BEST_THIRDS_ADVANCE;

  return (
    <>
      <fieldset className="rounded-md border border-zinc-200 p-4">
        <legend className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Clasificados de cada grupo
        </legend>
        <p className="mb-3 text-xs text-zinc-500">
          Marca los equipos que crees que pasan a la fase eliminatoria. Pasan los <strong>2</strong>{" "}
          primeros de cada grupo y, además, los{" "}
          <strong>{BEST_THIRDS_ADVANCE} mejores terceros</strong>. Por eso marca <strong>3</strong>{" "}
          equipos en exactamente <strong>{BEST_THIRDS_ADVANCE} grupos</strong> (los 2 primeros + el
          tercero que crees que se cuela) y <strong>2</strong> en los otros{" "}
          {groups.length - BEST_THIRDS_ADVANCE}. El orden no importa.
        </p>

        <div
          className={
            "mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs " +
            (groupsWithThree === BEST_THIRDS_ADVANCE
              ? "border-success/30 bg-success/10 text-success-fg"
              : "border-warning/30 bg-warning/10 text-warning-fg")
          }
        >
          Grupos con 3 equipos:{" "}
          <strong>
            {groupsWithThree} / {BEST_THIRDS_ADVANCE}
          </strong>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => {
            const cur = selected[g.code] ?? [];
            const count = cur.length;
            const full = count >= MAX_QUALIFIERS;
            const countTone =
              count < MIN_QUALIFIERS
                ? "text-danger-fg"
                : count === MAX_QUALIFIERS
                  ? "text-info-fg"
                  : "text-zinc-500";
            return (
              <fieldset key={g.code} className="rounded-md border border-zinc-200 p-3">
                <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
                  Grupo {g.code}
                  <span className={`text-xs font-normal ${countTone}`}>({count})</span>
                </legend>
                <div className="flex flex-col gap-1.5">
                  {g.teams.map((t) => {
                    const checked = cur.includes(t.id);
                    const blocked = !checked && full;
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-2 text-sm ${blocked ? "opacity-40" : ""}`}
                      >
                        <input
                          type="checkbox"
                          name={`qual_${g.code}`}
                          value={t.id}
                          checked={checked}
                          disabled={blocked}
                          onChange={() => toggle(g.code, t.id)}
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                        <TeamName name={t.name} />
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      </fieldset>

      {!valid && (
        <p className="border-warning/30 bg-warning/10 text-warning-fg rounded-md border p-3 text-xs">
          Para poder guardar: marca 3 equipos en exactamente {BEST_THIRDS_ADVANCE} grupos y 2 en los
          demás (mínimo {MIN_QUALIFIERS} por grupo). Ahora mismo tienes {groupsWithThree} grupos con
          3.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!valid}
          className="bg-primary text-primary-fg rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar predicciones
        </button>
        <Link
          href="/predictions/initial/public"
          className="text-sm text-zinc-600 underline hover:text-zinc-900"
        >
          Ver vista pública
        </Link>
      </div>
      <p className="text-xs text-zinc-500">
        Campeón, subcampeón, pichichi y mejor jugador puedes dejarlos para luego. Editable mientras
        el torneo no haya empezado.
      </p>
    </>
  );
}
