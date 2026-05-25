"use client";

import Link from "next/link";
import { SortableTable, type SortableColumn } from "@/components/ui/SortableTable";
import type { ProfileRef, RoundRef } from "@/lib/scoring/leaderboard";

// Per-user initial-prediction breakdown. `pichichi` / `mejor_jug` come
// from the `top_scorer` / `best_player` keys of the `initial` prediction
// score row; `clasificados` is the sum of `group_qualification` rows.
// `otros_initial` covers champion + runner_up — not surfaced as a column
// but rolled into the grand total so it stays consistent with what other
// Clasificación tabs show.
export type JornadaTableRow = {
  profile: ProfileRef;
  matchesTotal: number;
  pichichi: number;
  mejor_jug: number;
  clasificados: number;
  otros_initial: number;
  grandTotal: number;
  byRound: Record<string, number>;
};

type Props = {
  rows: JornadaTableRow[];
  rounds: RoundRef[];
  totalsByRound: Record<string, number>;
  totalsByExtra: { pichichi: number; mejor_jug: number; clasificados: number };
  userId: string;
};

// Compact column labels — full round/stage names blow out the table
// width. Falls back to the raw round name for unknown codes.
const ROUND_ABBREV: Record<string, string> = {
  group_md1: "J1",
  group_md2: "J2",
  group_md3: "J3",
  r32: "16avos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semis",
  third: "3r puesto",
  final: "Final",
};

export function JornadaTable({ rows, rounds, totalsByRound, totalsByExtra, userId }: Props) {
  const columns: SortableColumn<JornadaTableRow>[] = [
    {
      key: "name",
      label: "Participante",
      align: "left",
      thClassName: "sticky left-0 bg-zinc-50",
      tdClassName: "sticky left-0 bg-white font-medium",
      getValue: (r) => r.profile.display_name,
      render: (r) => (
        <>
          {r.profile.display_name}
          {r.profile.user_id === userId && (
            <span className="bg-info-light text-info-fg ml-1 rounded px-1.5 text-xs font-medium">
              tú
            </span>
          )}
        </>
      ),
    },
    ...rounds.map<SortableColumn<JornadaTableRow>>((r) => ({
      key: r.code,
      label: (
        <Link href={`/clasificacion/jornada/${r.code}`} className="hover:underline">
          {ROUND_ABBREV[r.code] ?? r.name}
        </Link>
      ),
      align: "right" as const,
      tdClassName: "font-oswald text-zinc-700",
      getValue: (row) => row.byRound[r.code] ?? 0,
    })),
    {
      key: "pichichi",
      label: "Pichichi",
      align: "right",
      tdClassName: "font-oswald text-zinc-700",
      getValue: (r) => r.pichichi,
    },
    {
      key: "mejor_jug",
      label: "Mejor Jug.",
      align: "right",
      tdClassName: "font-oswald text-zinc-700",
      getValue: (r) => r.mejor_jug,
    },
    {
      key: "clasificados",
      label: "Clasificados",
      align: "right",
      tdClassName: "font-oswald text-zinc-700",
      getValue: (r) => r.clasificados,
    },
    {
      key: "total",
      label: "Total",
      align: "right",
      tdClassName: "font-oswald font-bold",
      getValue: (r) => r.grandTotal,
    },
  ];

  const footer = (
    <tr className="border-t-2 border-zinc-300 bg-zinc-50">
      <td className="sticky left-0 bg-zinc-50 px-3 py-2 text-xs font-semibold whitespace-nowrap text-zinc-500 uppercase">
        Pts totales
      </td>
      {rounds.map((r) => (
        <td
          key={r.code}
          className="font-oswald px-3 py-2 text-right text-xs text-zinc-500"
        >
          {totalsByRound[r.code] ?? 0}
        </td>
      ))}
      <td className="font-oswald px-3 py-2 text-right text-xs text-zinc-500">
        {totalsByExtra.pichichi}
      </td>
      <td className="font-oswald px-3 py-2 text-right text-xs text-zinc-500">
        {totalsByExtra.mejor_jug}
      </td>
      <td className="font-oswald px-3 py-2 text-right text-xs text-zinc-500">
        {totalsByExtra.clasificados}
      </td>
      <td className="font-oswald px-3 py-2 text-right text-xs text-zinc-500">—</td>
    </tr>
  );

  return (
    <div className="mt-6 overflow-x-auto">
      <SortableTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.profile.user_id}
        footer={footer}
      />
    </div>
  );
}
