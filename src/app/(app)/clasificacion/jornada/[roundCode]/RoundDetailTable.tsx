"use client";

import Link from "next/link";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { TeamName } from "@/components/ui/TeamName";
import { Avatar } from "@/components/profiles/Avatar";
import { SortableTable, type SortableColumn } from "@/components/ui/SortableTable";

export type RoundDetailFixture = {
  id: string;
  kickoff_at: string;
  home: string;
  away: string;
  resultLabel: string | null; // "2-1" or null
};

export type RoundDetailProfile = {
  user_id: string;
  display_name: string;
  initials: string;
  avatarUrl?: string | null;
};

type Props = {
  fixtures: RoundDetailFixture[];
  profiles: RoundDetailProfile[];
  // user_id → fixture_id → points
  pointsByUserFixture: Record<string, Record<string, number>>;
  userId: string;
};

export function RoundDetailTable({ fixtures, profiles, pointsByUserFixture, userId }: Props) {
  const columns: SortableColumn<RoundDetailFixture>[] = [
    {
      key: "fixture",
      label: "Partido",
      align: "left",
      thClassName: "sticky left-0 bg-zinc-50",
      tdClassName: "sticky left-0 bg-white",
      getValue: (f) => f.kickoff_at,
      render: (f) => (
        <div className="flex flex-col">
          <Link href={`/clasificacion/partido/${f.id}`} className="font-medium hover:underline">
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <TeamName name={f.home} />
              {" vs "}
              <TeamName name={f.away} />
            </span>
          </Link>
          <span className="text-xs text-zinc-500">
            {formatMadridDateTime(f.kickoff_at)}
            {f.resultLabel ? ` · ${f.resultLabel}` : " · sin resultado"}
          </span>
        </div>
      ),
    },
    ...profiles.map<SortableColumn<RoundDetailFixture>>((p) => ({
      key: p.user_id,
      label: (
        <span className="inline-flex flex-col items-center gap-0.5" title={p.display_name}>
          <Avatar
            displayName={p.display_name}
            initials={p.initials}
            avatarUrl={p.avatarUrl ?? null}
            size={28}
          />
          <span className="text-[10px] text-zinc-500">
            {p.initials || p.display_name.slice(0, 2)}
          </span>
        </span>
      ),
      align: "center" as const,
      tdClassName: (f) => {
        const isMe = p.user_id === userId;
        const pts = pointsByUserFixture[p.user_id]?.[f.id];
        return `font-oswald ${isMe ? "bg-info-light" : ""} ${pts === undefined ? "text-zinc-400" : ""}`;
      },
      getValue: (f) => pointsByUserFixture[p.user_id]?.[f.id] ?? null,
      render: (f) => {
        const pts = pointsByUserFixture[p.user_id]?.[f.id];
        return pts === undefined ? "—" : pts;
      },
    })),
  ];

  // Per-participant totals across the round — independent of fixture sort.
  const footer = (
    <tr className="border-t-2 border-zinc-300 bg-zinc-50">
      <td className="sticky left-0 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500 uppercase">
        Total jornada
      </td>
      {profiles.map((p) => {
        let s = 0;
        for (const f of fixtures) s += pointsByUserFixture[p.user_id]?.[f.id] ?? 0;
        return (
          <td key={p.user_id} className="font-oswald px-3 py-2 text-center font-bold">
            {s}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="mt-6 overflow-x-auto">
      <SortableTable columns={columns} rows={fixtures} getRowKey={(f) => f.id} footer={footer} />
    </div>
  );
}
