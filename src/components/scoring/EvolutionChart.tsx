// Server-rendered SVG line chart. Each user is a polyline; the last
// point of each line carries a small bubble with their initials.
//
// No client JS, no Recharts: we have at most 10 users × 9 rounds.

import type { EvolutionPoint } from "@/lib/scoring/leaderboard";

const COLORS = [
  "#059669", // emerald-600
  "#0284c7", // sky-600
  "#d97706", // amber-600
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
  "#0891b2", // cyan-600
  "#65a30d", // lime-600
  "#ea580c", // orange-600
  "#4f46e5", // indigo-600
];

type UserMeta = { user_id: string; display_name: string; initials: string };

export function EvolutionChart({ points, users }: { points: EvolutionPoint[]; users: UserMeta[] }) {
  if (points.length === 0 || users.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Aún no hay puntuaciones para pintar el gráfico.
      </p>
    );
  }

  const WIDTH = 720;
  const HEIGHT = 360;
  const PAD = { top: 20, right: 80, bottom: 50, left: 50 };
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  let maxY = 0;
  for (const pt of points) {
    for (const v of pt.cumulativeByUser.values()) {
      if (v > maxY) maxY = v;
    }
  }
  if (maxY === 0) maxY = 10;

  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xFor = (i: number) => PAD.left + i * stepX;
  const yFor = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  // Y-axis ticks: 0, ¼, ½, ¾, max (rounded to nearest 10)
  const niceMax = Math.max(10, Math.ceil(maxY / 10) * 10);
  const yTicks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Evolución acumulada de puntos por jornada"
        className="block w-full text-zinc-700 dark:text-zinc-300"
      >
        {/* Grid lines */}
        {yTicks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={`grid-${i}`}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y}
                y2={y}
                className="stroke-zinc-200 dark:stroke-zinc-800"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                className="fill-zinc-500 dark:fill-zinc-400"
              >
                {Math.round(t)}
              </text>
            </g>
          );
        })}
        {/* X-axis labels */}
        {points.map((pt, i) => (
          <text
            key={pt.roundCode}
            x={xFor(i)}
            y={HEIGHT - PAD.bottom + 18}
            textAnchor="middle"
            fontSize={10}
            className="fill-zinc-500 dark:fill-zinc-400"
          >
            {pt.roundName}
          </text>
        ))}
        {/* Lines per user */}
        {users.map((u, idx) => {
          const color = COLORS[idx % COLORS.length];
          const seg = points
            .map(
              (pt, i) =>
                `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(pt.cumulativeByUser.get(u.user_id) ?? 0)}`,
            )
            .join(" ");
          const last = points[points.length - 1];
          const lastY = yFor(last.cumulativeByUser.get(u.user_id) ?? 0);
          const lastX = xFor(points.length - 1);
          return (
            <g key={u.user_id}>
              <path d={seg} fill="none" stroke={color} strokeWidth={2} />
              {points.map((pt, i) => (
                <circle
                  key={`${u.user_id}-${pt.roundCode}`}
                  cx={xFor(i)}
                  cy={yFor(pt.cumulativeByUser.get(u.user_id) ?? 0)}
                  r={3}
                  fill={color}
                />
              ))}
              {/* End bubble with initials */}
              <circle cx={lastX + 18} cy={lastY} r={12} fill={color} />
              <text
                x={lastX + 18}
                y={lastY + 3}
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill="#ffffff"
              >
                {u.initials.slice(0, 2).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <ul className="mt-3 flex flex-wrap gap-3 text-xs">
        {users.map((u, idx) => {
          const color = COLORS[idx % COLORS.length];
          return (
            <li key={u.user_id} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span>
                <strong>{u.initials.slice(0, 2).toUpperCase()}</strong> · {u.display_name}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
