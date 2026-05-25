"use client";

import { SortableTable, type SortableColumn } from "@/components/ui/SortableTable";
import { CATEGORY_LABELS, type CategoryBucket } from "@/lib/scoring/breakdownLabels";
import type { ByCategoryRow } from "@/lib/scoring/leaderboard";

type Props = {
  rows: ByCategoryRow[];
  categoryOrder: CategoryBucket[];
  userId: string;
};

export function CategoriaTable({ rows, categoryOrder, userId }: Props) {
  const columns: SortableColumn<ByCategoryRow>[] = [
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
    ...categoryOrder.map<SortableColumn<ByCategoryRow>>((cat) => ({
      key: cat,
      label: CATEGORY_LABELS[cat],
      align: "right" as const,
      tdClassName: "font-oswald",
      getValue: (r) => r.byCategory[cat],
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
      <SortableTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.profile.user_id}
      />
    </div>
  );
}
