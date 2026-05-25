function toneFor(pct: number): string {
  if (pct <= 0) return "bg-zinc-300";
  if (pct < 35) return "bg-warning";
  if (pct < 75) return "bg-info";
  return "bg-success";
}

export function PointsBar({
  value,
  max,
  height = 8,
}: {
  value: number;
  max: number;
  height?: number;
}) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  return (
    <div
      className="w-full rounded-full bg-zinc-200"
      style={{ height }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div className={`h-full rounded-full ${toneFor(pct)}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
