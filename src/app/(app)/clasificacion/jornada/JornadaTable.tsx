"use client";

import Link from "next/link";
import { SortableTable, type SortableColumn } from "@/components/ui/SortableTable";
import { Avatar } from "@/components/profiles/Avatar";
import type { ProfileRef, RoundRef } from "@/lib/scoring/leaderboard";

// Per-user initial-prediction breakdown. `campeon` / `subcampeon` /
// `pichichi` / `mejor_jug` / `ultimo` come from the `initial` prediction
// score row; `clasificados` is the sum of `group_qualification` rows.
export type JornadaTableRow = {
  profile: ProfileRef;
  matchesTotal: number;
  campeon: number;
  subcampeon: number;
  pichichi: number;
  mejor_jug: number;
  ultimo: number;
  clasificados: number;
  grandTotal: number;
  byRound: Record<string, number>;
};

type Props = {
  rows: JornadaTableRow[];
  rounds: RoundRef[];
  totalsByRound: Record<string, number>;
  totalsByExtra: {
    campeon: number;
    subcampeon: number;
    pichichi: number;
    mejor_jug: number;
    ultimo: number;
    clasificados: number;
  };
  userId: string;
  avatarUrlByUser: Record<string, string | null>;
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

export function JornadaTable({
  rows,
  rounds,
  totalsByRound,
  totalsByExtra,
  userId,
  avatarUrlByUser,
}: Props) {
  const columns: SortableColumn<JornadaTableRow>[] = [
    {
      key: "name",
      label: "Participante",
      align: "left",
      thClassName: "sticky left-0 bg-zinc-50",
      tdClassName: "sticky left-0 bg-white font-medium",
      getValue: (r) => r.profile.display_name,
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <Avatar
            displayName={r.profile.display_name}
            initials={r.profile.initials}
            avatarUrl={avatarUrlByUser[r.profile.user_id] ?? null}
          />
          <span>{r.profile.display_name}</span>
          {r.profile.user_id === userId && (
            <span className="bg-info-light text-info-fg ml-1 rounded px-1.5 text-xs font-medium">
              tú
            </span>
          )}
        </span>
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
      key: "campeon",
      label: "Campeón",
      align: "right",
      tdClassName: "font-oswald text-zinc-700",
      getValue: (r) => r.campeon,
    },
    {
      key: "subcampeon",
      label: "Subcampeón",
      align: "right",
      tdClassName: "font-oswald text-zinc-700",
      getValue: (r) => r.subcampeon,
    },
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
      key: "ultimo",
      label: "Último",
      align: "right",
      tdClassName: "font-oswald text-zinc-700",
      getValue: (r) => r.ultimo,
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
        <td key={r.code} className="font-oswald px-3 py-2 text-right text-xs text-zinc-500">
          {totalsByRound[r.code] ?? 0}
        </td>
      ))}
      <td className="font-oswald px-3 py-2 text-right text-xs text-zinc-500">
        {totalsByExtra.campeon}
      </td>
      <td className="font-oswald px-3 py-2 text-right text-xs text-zinc-500">
        {totalsByExtra.subcampeon}
      </td>
      <td className="font-oswald px-3 py-2 text-right text-xs text-zinc-500">
        {totalsByExtra.pichichi}
      </td>
      <td className="font-oswald px-3 py-2 text-right text-xs text-zinc-500">
        {totalsByExtra.mejor_jug}
      </td>
      <td className="font-oswald px-3 py-2 text-right text-xs text-zinc-500">
        {totalsByExtra.ultimo}
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
        tableClassName="w-full border-collapse text-sm"
      />
    </div>
  );
}
