import { BREAKDOWN_ENTRIES, isMetaKey } from "@/lib/scoring/breakdownLabels";

export type BreakdownTableProps = {
  breakdown: Record<string, unknown>;
  pointsTotal: number;
  subtotal?: number;
  multiplier?: number;
};

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

export function BreakdownTable({
  breakdown,
  pointsTotal,
  subtotal,
  multiplier,
}: BreakdownTableProps) {
  const rows = BREAKDOWN_ENTRIES.map((entry) => {
    const value = num(breakdown[entry.key]);
    if (value === null) return null;
    return { entry, value };
  }).filter((r): r is { entry: (typeof BREAKDOWN_ENTRIES)[number]; value: number } => r !== null);

  const sub = subtotal ?? num(breakdown._subtotal) ?? 0;
  const mult = multiplier ?? num(breakdown._multiplier) ?? 1;
  const groupCode = typeof breakdown._group === "string" ? breakdown._group : null;

  const knownKeys = new Set(BREAKDOWN_ENTRIES.map((e) => e.key));
  const extraRows = Object.entries(breakdown)
    .filter(([k, v]) => !isMetaKey(k) && !knownKeys.has(k) && typeof v === "number")
    .map(([k, v]) => ({ key: k, value: v as number }));

  if (rows.length === 0 && extraRows.length === 0) {
    return <div className="text-sm text-zinc-500">Sin aciertos en este partido (0 puntos).</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        <tr>
          <th className="py-1.5 pr-2">Criterio</th>
          <th className="py-1.5 pr-2 text-right">Puntos</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ entry, value }) => (
          <tr key={entry.key} className="border-t border-zinc-100">
            <td className="py-1.5 pr-2">{entry.label}</td>
            <td className="py-1.5 pr-2 text-right font-mono">{value}</td>
          </tr>
        ))}
        {extraRows.map((r) => (
          <tr key={r.key} className="border-t border-zinc-100">
            <td className="py-1.5 pr-2">{r.key}</td>
            <td className="py-1.5 pr-2 text-right font-mono">{r.value}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-zinc-300 text-sm">
        <tr>
          <td className="py-1.5 pr-2 text-zinc-600">Subtotal</td>
          <td className="py-1.5 pr-2 text-right font-mono">{sub}</td>
        </tr>
        {mult !== 1 && (
          <tr>
            <td className="py-1.5 pr-2 text-zinc-600">Multiplicador</td>
            <td className="py-1.5 pr-2 text-right font-mono">×{mult}</td>
          </tr>
        )}
        <tr>
          <td className="py-1.5 pr-2 font-semibold">Total</td>
          <td className="py-1.5 pr-2 text-right font-mono font-semibold">{pointsTotal}</td>
        </tr>
        {groupCode && (
          <tr>
            <td className="py-1.5 pr-2 text-xs text-zinc-500" colSpan={2}>
              Grupo {groupCode}
            </td>
          </tr>
        )}
      </tfoot>
    </table>
  );
}
