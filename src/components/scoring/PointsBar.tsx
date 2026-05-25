// Horizontal bar that visualises `value / max` as a colored fill on
// top of a neutral track. Pure CSS, no client JS.
//
// Colors:
//   - 0%       → zinc track only
//   - 1–34%    → amber fill
//   - 35–74%   → sky fill
//   - 75–100%  → emerald fill

function toneFor(pct: number): { bar: string } {
  if (pct <= 0) return { bar: "bg-zinc-300 dark:bg-zinc-700" };
  if (pct < 35) return { bar: "bg-amber-400 dark:bg-amber-500" };
  if (pct < 75) return { bar: "bg-sky-400 dark:bg-sky-500" };
  return { bar: "bg-emerald-500 dark:bg-emerald-400" };
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
  const tone = toneFor(pct);
  return (
    <div
      className="w-full rounded-full bg-zinc-200 dark:bg-zinc-800"
      style={{ height }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
