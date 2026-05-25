"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Lightweight click-to-open popover around a static info pill. The body
// is server-rendered (BreakdownTable + a wrapping <details>-like card)
// and passed as `children`. We only need client state for open/close.

export function BreakdownPopover({
  pointsTotal,
  label,
  children,
}: {
  pointsTotal: number;
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-expanded={open}
        aria-label={label ?? "Ver desglose de puntos"}
      >
        <span className="font-mono">{pointsTotal} pts</span>
        <span aria-hidden="true" className="text-zinc-400">
          ⓘ
        </span>
      </button>
      {open && (
        <span
          role="dialog"
          className="absolute top-full right-0 z-30 mt-1 block w-72 rounded-md border border-zinc-200 bg-white p-3 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {children}
        </span>
      )}
    </span>
  );
}
