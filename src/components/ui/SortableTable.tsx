"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

type SortDir = "asc" | "desc" | null;

export type SortableColumn<T> = {
  key: string;
  label: ReactNode;
  align?: "left" | "right" | "center";
  thClassName?: string;
  tdClassName?: string | ((row: T) => string);
  // Value used for comparison when this column is the active sort.
  // Return null if the row has no comparable value (sorts last).
  getValue: (row: T) => number | string | null;
  // Custom cell renderer. Defaults to String(getValue(row)).
  render?: (row: T) => ReactNode;
  // Set to false to make this column non-sortable (header stays static).
  sortable?: boolean;
};

type Props<T> = {
  columns: SortableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  rowClassName?: string | ((row: T) => string);
  // Extra <tr>s to render after the sorted rows (e.g. totals).
  footer?: ReactNode;
  tableClassName?: string;
  theadClassName?: string;
};

function alignCls(a: "left" | "right" | "center" | undefined) {
  return a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
}

// Generic table with column-header click sorting.
//
// Sort cycle per column: first click → ASC, second → DESC, third → off
// (back to the order the rows were provided in). Clicking a different
// column resets to ASC for that column.
export function SortableTable<T>({
  columns,
  rows,
  getRowKey,
  rowClassName,
  footer,
  tableClassName = "w-full border-collapse text-sm",
  theadClassName = "bg-zinc-50 text-left text-xs text-zinc-500 uppercase",
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const toggle = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
    } else setSortDir("asc");
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const factor = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.getValue(a);
      const vb = col.getValue(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "es") * factor;
    });
  }, [rows, columns, sortKey, sortDir]);

  return (
    <table className={tableClassName}>
      <thead className={theadClassName}>
        <tr>
          {columns.map((c) => {
            const sortable = c.sortable !== false;
            const active = sortKey === c.key;
            const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
            const aria = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";
            return (
              <th
                key={c.key}
                className={`px-3 py-2 font-semibold ${alignCls(c.align)} ${c.thClassName ?? ""}`}
                aria-sort={aria}
              >
                {sortable ? (
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={`inline-flex w-full items-center gap-1 whitespace-nowrap select-none hover:text-zinc-900 ${
                      c.align === "right"
                        ? "justify-end"
                        : c.align === "center"
                          ? "justify-center"
                          : ""
                    } ${active ? "text-zinc-900" : ""}`}
                  >
                    <span>{c.label}</span>
                    <Icon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} aria-hidden />
                  </button>
                ) : (
                  c.label
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => {
          const rowCls = typeof rowClassName === "function" ? rowClassName(row) : rowClassName;
          return (
            <tr key={getRowKey(row)} className={`border-t border-zinc-100 ${rowCls ?? ""}`}>
              {columns.map((c) => {
                const tdCls =
                  typeof c.tdClassName === "function" ? c.tdClassName(row) : c.tdClassName;
                return (
                  <td key={c.key} className={`px-3 py-2 ${alignCls(c.align)} ${tdCls ?? ""}`}>
                    {c.render ? c.render(row) : c.getValue(row)}
                  </td>
                );
              })}
            </tr>
          );
        })}
        {footer}
      </tbody>
    </table>
  );
}
