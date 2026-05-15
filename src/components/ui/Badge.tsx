import type { ReactNode } from "react";

type Tone = "zinc" | "amber" | "emerald" | "rose" | "sky";

const TONE_STYLES: Record<Tone, string> = {
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
};

export function Badge({ tone = "zinc", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  scheduled: "zinc",
  locked: "amber",
  completed: "emerald",
  cancelled: "rose",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  locked: "Bloqueado",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

export function FixtureStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "zinc"}>{STATUS_LABELS[status] ?? status}</Badge>;
}
