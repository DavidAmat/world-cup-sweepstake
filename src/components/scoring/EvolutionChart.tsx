import type { EvolutionPoint } from "@/lib/scoring/leaderboard";

const ROUND_SHORT_LABEL: Record<string, string> = {
  group_md1: "J1",
  group_md2: "J2",
  group_md3: "J3",
  r32: "16avos",
  r16: "8avos",
  qf: "4tos",
  sf: "Semis",
  third: "3.º",
  final: "Final",
};

const COLORS = [
  "#3cdcb4", // success green
  "#4681ff", // primary blue
  "#ffc83c", // warning yellow
  "#FE6060", // danger red
  "#816eff", // special lavender
  "#ff6495", // pink
  "#00E7E7", // info cyan
  "#ff8b32", // orange
  "#9C9C9C", // muted gray
  "#664E3C", // brown
];

type UserMeta = {
  user_id: string;
  display_name: string;
  initials: string;
  avatarUrl?: string | null;
};

// Avatar disc that lives at the end of every user's evolution line.
// Bigger than the old initials badge (R) and renders the user's photo
// when available, falling back to the colored initials disc otherwise.
const AVATAR_R = 18;
const AVATAR_STROKE = 2;

export function EvolutionChart({ points, users }: { points: EvolutionPoint[]; users: UserMeta[] }) {
  if (points.length === 0 || users.length === 0) {
    return <p className="text-sm text-zinc-600">Aún no hay puntuaciones para pintar el gráfico.</p>;
  }

  const BASE_WIDTH = 720;
  const HEIGHT = 540;
  const PAD = { top: 28, right: 90, bottom: 50, left: 50 };
  const innerW = BASE_WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  // Final cumulative score per user, grouped so tied users can fan their
  // end-of-line avatars out horizontally to the right instead of stacking
  // on the same spot (where they'd overlap and hide each other).
  const lastPoint = points[points.length - 1];
  const finalScoreFor = (uid: string) => lastPoint.cumulativeByUser.get(uid) ?? 0;
  const tieIndex = new Map<string, number>();
  let maxTie = 1;
  {
    const seen = new Map<number, number>();
    for (const u of users) {
      const s = finalScoreFor(u.user_id);
      const n = seen.get(s) ?? 0;
      tieIndex.set(u.user_id, n);
      seen.set(s, n + 1);
      if (n + 1 > maxTie) maxTie = n + 1;
    }
  }
  const avatarStep = AVATAR_R * 2 + 4; // horizontal spacing between tied avatars
  // Extra room on the right so the widest tie cohort isn't clipped by the viewBox.
  const WIDTH = BASE_WIDTH + (maxTie - 1) * avatarStep;

  // y-axis floor: min cumulative across users at the first round (J1).
  // Starting at 0 wastes vertical space when everyone already has 25+ pts
  // by the end of jornada 1 — clipping the bottom makes deltas readable
  // and spreads avatars at the last x position so they don't overlap.
  let minYFirst = Infinity;
  if (points.length > 0) {
    for (const v of points[0].cumulativeByUser.values()) {
      if (v < minYFirst) minYFirst = v;
    }
  }
  if (!Number.isFinite(minYFirst)) minYFirst = 0;

  let maxY = 0;
  for (const pt of points) {
    for (const v of pt.cumulativeByUser.values()) {
      if (v > maxY) maxY = v;
    }
  }
  if (maxY === 0) maxY = 10;

  // Breathing room: ~6% of the visible range on each side so markers
  // don't kiss the chart's top/bottom edges.
  const rawRange = Math.max(1, maxY - minYFirst);
  const pad = Math.max(2, rawRange * 0.06);
  const yMin = Math.max(0, Math.floor(minYFirst - pad));
  const yMax = Math.ceil(maxY + pad);
  const yRange = Math.max(1, yMax - yMin);

  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xFor = (i: number) => PAD.left + i * stepX;
  const yFor = (v: number) => PAD.top + innerH - ((v - yMin) / yRange) * innerH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => yMin + p * yRange);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Evolución acumulada de puntos por jornada"
        className="block w-full text-zinc-700"
      >
        {yTicks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={`grid-${i}`}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y}
                y2={y}
                stroke="#e4e4e7"
                strokeWidth={1}
              />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#9C9C9C">
                {Math.round(t)}
              </text>
            </g>
          );
        })}
        {points.map((pt, i) => (
          <text
            key={pt.roundCode}
            x={xFor(i)}
            y={HEIGHT - PAD.bottom + 18}
            textAnchor="middle"
            fontSize={10}
            fill="#9C9C9C"
          >
            {ROUND_SHORT_LABEL[pt.roundCode] ?? pt.roundName}
          </text>
        ))}
        <defs>
          {users.map((u) => (
            <clipPath key={`clip-${u.user_id}`} id={`avatar-clip-${u.user_id}`}>
              <circle cx={0} cy={0} r={AVATAR_R - AVATAR_STROKE} />
            </clipPath>
          ))}
        </defs>
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
          // Fan tied avatars rightward: first sits next to the dot, the rest
          // step right by one avatar-width each so all photos stay visible.
          const tIdx = tieIndex.get(u.user_id) ?? 0;
          const avatarCx = lastX + AVATAR_R + 4 + tIdx * avatarStep;
          return (
            <g key={u.user_id}>
              <path d={seg} fill="none" stroke={color} strokeWidth={2} />
              {points.map((pt, i) => {
                const v = pt.cumulativeByUser.get(u.user_id) ?? 0;
                const cy = yFor(v);
                return (
                  <g key={`${u.user_id}-${pt.roundCode}`}>
                    <circle cx={xFor(i)} cy={cy} r={3} fill={color} />
                    <text
                      x={xFor(i)}
                      y={cy - 7}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight="bold"
                      fill={color}
                    >
                      {Math.round(v)}
                    </text>
                  </g>
                );
              })}
              {u.avatarUrl ? (
                <g transform={`translate(${avatarCx}, ${lastY})`}>
                  <image
                    href={u.avatarUrl}
                    x={-(AVATAR_R - AVATAR_STROKE)}
                    y={-(AVATAR_R - AVATAR_STROKE)}
                    width={(AVATAR_R - AVATAR_STROKE) * 2}
                    height={(AVATAR_R - AVATAR_STROKE) * 2}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#avatar-clip-${u.user_id})`}
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={AVATAR_R - AVATAR_STROKE / 2}
                    fill="none"
                    stroke={color}
                    strokeWidth={AVATAR_STROKE}
                  />
                </g>
              ) : (
                <>
                  <circle cx={avatarCx} cy={lastY} r={AVATAR_R} fill={color} />
                  <text
                    x={avatarCx}
                    y={lastY + 4}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight="bold"
                    fill="#ffffff"
                  >
                    {u.initials.slice(0, 2).toUpperCase()}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
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
