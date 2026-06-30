"use client";

import { useMemo, useState } from "react";
import type { EvolutionPoint } from "@/lib/scoring/leaderboard";
import { EvolutionChart } from "./EvolutionChart";

type UserMeta = {
  user_id: string;
  display_name: string;
  initials: string;
  avatarUrl?: string | null;
  color: string;
};

// Client wrapper around the (presentational) EvolutionChart: lets the viewer
// pick which participants to plot. Defaults to all selected. Colours are
// assigned once on the server from the full roster, so each user keeps the
// same colour whatever subset is shown.
export function EvolutionExplorer({
  points,
  users,
}: {
  points: EvolutionPoint[];
  users: UserMeta[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(users.map((u) => u.user_id)),
  );

  const visibleUsers = useMemo(
    () => users.filter((u) => selected.has(u.user_id)),
    [users, selected],
  );

  const allSelected = selected.size === users.length;
  const noneSelected = selected.size === 0;

  const toggle = (userId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium text-zinc-500">Participantes:</span>
        {users.map((u) => {
          const active = selected.has(u.user_id);
          return (
            <button
              key={u.user_id}
              type="button"
              onClick={() => toggle(u.user_id)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? "border-zinc-300 bg-white text-zinc-800 shadow-sm"
                  : "border-zinc-200 bg-zinc-50 text-zinc-400"
              }`}
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: active ? u.color : "#d4d4d8" }}
                aria-hidden="true"
              />
              <span>{u.display_name}</span>
            </button>
          );
        })}
        <span className="mx-1 h-4 w-px bg-zinc-200" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setSelected(new Set(users.map((u) => u.user_id)))}
          disabled={allSelected}
          className="rounded-full px-3 py-1 text-xs font-medium text-primary hover:underline disabled:text-zinc-300 disabled:no-underline"
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setSelected(new Set())}
          disabled={noneSelected}
          className="rounded-full px-3 py-1 text-xs font-medium text-zinc-500 hover:underline disabled:text-zinc-300 disabled:no-underline"
        >
          Ninguno
        </button>
      </div>

      {visibleUsers.length === 0 ? (
        <p className="text-sm text-zinc-600">
          Selecciona al menos un participante para ver el gráfico.
        </p>
      ) : (
        <EvolutionChart points={points} users={visibleUsers} />
      )}
    </div>
  );
}
