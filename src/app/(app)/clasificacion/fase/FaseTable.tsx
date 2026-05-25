"use client";

import { SortableTable, type SortableColumn } from "@/components/ui/SortableTable";
import type { ProfileRef, StageRef } from "@/lib/scoring/leaderboard";

export type FaseTableRow = {
  profile: ProfileRef;
  total: number;
  byStage: Record<string, number>;
};

type Props = {
  rows: FaseTableRow[];
  stages: StageRef[];
  userId: string;
};

// Compact column labels — the full stage names ("Dieciseisavos de final"…)
// blow out the table width. Fall back to the original name for unknown
// codes so the table still works if catalog entries are added.
const STAGE_ABBREV: Record<string, string> = {
  group_stage: "Grupos",
  round_of_32: "16avos",
  round_of_16: "Octavos",
  quarter_final: "Cuartos",
  semi_final: "Semis",
  third_place: "3r puesto",
  final: "Final",
};

export function FaseTable({ rows, stages, userId }: Props) {
  const columns: SortableColumn<FaseTableRow>[] = [
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
    ...stages.map<SortableColumn<FaseTableRow>>((s) => ({
      key: s.code,
      label: STAGE_ABBREV[s.code] ?? s.name,
      align: "right" as const,
      tdClassName: "font-oswald",
      getValue: (r) => r.byStage[s.code] ?? 0,
    })),
    {
      key: "total",
      label: "Total",
      align: "right",
      tdClassName: "font-oswald font-bold",
      getValue: (r) => r.total,
    },
  ];

  return (
    <div className="mt-6 overflow-x-auto">
      <SortableTable columns={columns} rows={rows} getRowKey={(r) => r.profile.user_id} />
    </div>
  );
}
