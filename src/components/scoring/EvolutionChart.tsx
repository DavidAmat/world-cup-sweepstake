import type { EvolutionPoint } from "@/lib/scoring/leaderboard";

export const EVOLUTION_COLORS = [
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
  // Stable per-user line colour, assigned by the caller from the full roster
  // so a user keeps the same colour regardless of which subset is plotted.
  color?: string;
  // When true the line is drawn as a faint gray reference (no dots/avatar)
  // instead of in the user's colour — used for de-selected participants.
  dimmed?: boolean;
};

// Faint gray used for de-selected reference lines.
const DIMMED_STROKE = "#a1a1aa"; // zinc-400
const DIMMED_OPACITY = 0.28;

// Avatar disc that lives at the end of every user's evolution line. Kept
// deliberately small — with ~12 users a bigger disc crowds the right margin.
const AVATAR_R = 13;
const AVATAR_STROKE = 2;

export function EvolutionChart({ points, users }: { points: EvolutionPoint[]; users: UserMeta[] }) {
  if (points.length === 0 || users.length === 0) {
    return <p className="text-sm text-zinc-600">Aún no hay puntuaciones para pintar el gráfico.</p>;
  }

  // Horizontal spacing per day; the chart scrolls (overflow-x-auto) when the
  // tournament has more dates than fit at this density.
  const COL = 44;
  const HEIGHT = 520;
  const PAD = { top: 24, right: 80, bottom: 64, left: 46 };
  const innerW = Math.max(360, (points.length - 1) * COL);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const BASE_WIDTH = PAD.left + PAD.right + innerW;

  // Final cumulative score per user, grouped so tied users can fan their
  // end-of-line avatars out horizontally to the right instead of stacking
  // on the same spot (where they'd overlap and hide each other).
  const lastPoint = points[points.length - 1];
  const finalScoreFor = (uid: string) => lastPoint.cumulativeByUser.get(uid) ?? 0;
  const tieIndex = new Map<string, number>();
  let maxTie = 1;
  {
    const seen = new Map<number, number>();
    // Only highlighted users get an end-of-line avatar, so only they take part
    // in the tie-fanning layout.
    for (const u of users) {
      if (u.dimmed) continue;
      const s = finalScoreFor(u.user_id);
      const n = seen.get(s) ?? 0;
      tieIndex.set(u.user_id, n);
      seen.set(s, n + 1);
      if (n + 1 > maxTie) maxTie = n + 1;
    }
  }
  const avatarStep = AVATAR_R * 2 + 3; // horizontal spacing between tied avatars
  // Extra room on the right so the widest tie cohort isn't clipped by the viewBox.
  const WIDTH = BASE_WIDTH + (maxTie - 1) * avatarStep;

  // y-axis floor: min cumulative across the plotted users at the first date.
  // Starting at 0 wastes vertical space when everyone already has 25+ pts on
  // day one — clipping the bottom makes the deltas between users readable.
  // Scoped to every plotted user (highlighted + dimmed reference lines) so the
  // axis stays stable as the viewer toggles the selection.
  let minYFirst = Infinity;
  for (const u of users) {
    const v = points[0].cumulativeByUser.get(u.user_id) ?? 0;
    if (v < minYFirst) minYFirst = v;
  }
  if (!Number.isFinite(minYFirst)) minYFirst = 0;

  let maxY = 0;
  for (const pt of points) {
    for (const u of users) {
      const v = pt.cumulativeByUser.get(u.user_id) ?? 0;
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
  const axisY = HEIGHT - PAD.bottom;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => yMin + p * yRange);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Evolución acumulada de puntos por día"
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
        {/* Date labels, rotated 90° (vertical) so dozens of days fit. */}
        {points.map((pt, i) => (
          <text
            key={pt.dateKey}
            transform={`translate(${xFor(i)}, ${axisY + 8}) rotate(-90)`}
            textAnchor="end"
            dy="0.32em"
            fontSize={10}
            fill="#9C9C9C"
          >
            {pt.label}
          </text>
        ))}
        <defs>
          {users.map((u) => (
            <clipPath key={`clip-${u.user_id}`} id={`avatar-clip-${u.user_id}`}>
              <circle cx={0} cy={0} r={AVATAR_R - AVATAR_STROKE} />
            </clipPath>
          ))}
        </defs>
        {/* Draw dimmed (de-selected) reference lines first so the highlighted
            colour lines and avatars sit on top of them. */}
        {[...users]
          .sort((a, b) => Number(b.dimmed ?? false) - Number(a.dimmed ?? false))
          .map((u, idx) => {
            const color = u.color ?? EVOLUTION_COLORS[idx % EVOLUTION_COLORS.length];
            const seg = points
              .map(
                (pt, i) =>
                  `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(pt.cumulativeByUser.get(u.user_id) ?? 0)}`,
              )
              .join(" ");

            // De-selected participants: a single faint gray line, no markers or
            // avatar — just enough to keep their trajectory as a reference.
            if (u.dimmed) {
              return (
                <path
                  key={u.user_id}
                  d={seg}
                  fill="none"
                  stroke={DIMMED_STROKE}
                  strokeOpacity={DIMMED_OPACITY}
                  strokeWidth={1.5}
                />
              );
            }

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
                    <g key={`${u.user_id}-${pt.dateKey}`}>
                      {/* Small visible dot, no inline value text (too many users). */}
                      <circle cx={xFor(i)} cy={cy} r={2.5} fill={color} />
                      {/* Wider transparent hit area so the native tooltip is easy
                        to trigger; <title> shows the value on hover. */}
                      <circle cx={xFor(i)} cy={cy} r={7} fill="transparent">
                        <title>{`${u.display_name} · ${pt.label}: ${Math.round(v)} pts`}</title>
                      </circle>
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
                    <title>{`${u.display_name}: ${Math.round(finalScoreFor(u.user_id))} pts`}</title>
                  </g>
                ) : (
                  <g transform={`translate(${avatarCx}, ${lastY})`}>
                    <circle cx={0} cy={0} r={AVATAR_R} fill={color} />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight="bold"
                      fill="#ffffff"
                    >
                      {u.initials.slice(0, 2).toUpperCase()}
                    </text>
                    <title>{`${u.display_name}: ${Math.round(finalScoreFor(u.user_id))} pts`}</title>
                  </g>
                )}
              </g>
            );
          })}
      </svg>
    </div>
  );
}
