import type { ReactNode } from "react";

type Tone = "zinc" | "warning" | "success" | "danger" | "info" | "special";

const TONE_STYLES: Record<Tone, string> = {
  zinc: "bg-zinc-100 text-zinc-700",
  warning: "bg-warning-light text-warning-fg",
  success: "bg-success-light text-success-fg",
  danger: "bg-danger-light text-danger-fg",
  info: "bg-info-light text-info-fg",
  special: "bg-special-light text-special-fg",
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
  locked: "warning",
  completed: "success",
  cancelled: "danger",
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
