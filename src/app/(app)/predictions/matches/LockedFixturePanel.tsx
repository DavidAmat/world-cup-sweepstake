"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BreakdownPopover } from "@/components/scoring/BreakdownPopover";
import { BreakdownTable } from "@/components/scoring/BreakdownTable";

// 6-column grid that vertically aligns the home/away goals across the
// real result row, the current user's prediction and every other user's
// prediction. The "Pts" column is fixed width so the ⓘ popover lines up.
const ROW_CLS =
  "grid grid-cols-[minmax(110px,1.4fr)_2.5rem_0.6rem_2.5rem_minmax(180px,1.6fr)_4.5rem] items-center gap-2 px-3 py-1.5 text-sm";

type Prediction = {
  h90: number;
  a90: number;
  et: boolean;
  pen: boolean;
  qual: string | null;
};

type Score = { points: number; breakdown: Record<string, unknown> };

export type LockedEntry = {
  user_id: string;
  display_name: string;
  prediction: Prediction | null;
  score: Score | null;
};

export type LockedRealResult = {
  h: number;
  a: number;
  et: boolean;
  pen: boolean;
  qualifiedTeamId: string | null;
};

type Props = {
  homeTeam: string;
  awayTeam: string;
  homeId: string;
  awayId: string;
  isKnockout: boolean;
  realResult: LockedRealResult | null;
  myEntry: LockedEntry;
  otherEntries: LockedEntry[];
};

function teamName(id: string | null, homeId: string, awayId: string, home: string, away: string) {
  if (!id) return "—";
  if (id === homeId) return home;
  if (id === awayId) return away;
  return "—";
}

function ExtraInfo({ et, pen, qual }: { et: boolean; pen: boolean; qual: string }) {
  return (
    <span className="text-xs text-zinc-600 dark:text-zinc-400">
      {et ? "Prórroga" : "Sin prórroga"} · {pen ? "penaltis" : "sin penaltis"} · pasa{" "}
      <strong>{qual}</strong>
    </span>
  );
}

function PointsCell({ score, popoverLabel }: { score: Score | null; popoverLabel: string }) {
  if (!score) {
    return <span className="text-right text-xs text-zinc-400">—</span>;
  }
  return (
    <BreakdownPopover pointsTotal={score.points} label={popoverLabel}>
      <BreakdownTable breakdown={score.breakdown} pointsTotal={score.points} />
    </BreakdownPopover>
  );
}

function Row({
  label,
  h,
  a,
  extra,
  rightCell,
  accent,
}: {
  label: ReactNode;
  h: ReactNode;
  a: ReactNode;
  extra: ReactNode;
  rightCell: ReactNode;
  accent?: string;
}) {
  return (
    <div className={`${ROW_CLS} ${accent ?? ""}`}>
      <span className="truncate font-medium">{label}</span>
      <span className="text-center font-mono font-semibold">{h}</span>
      <span className="text-center text-zinc-400">-</span>
      <span className="text-center font-mono font-semibold">{a}</span>
      <span className="text-xs">{extra}</span>
      <div className="flex justify-end">{rightCell}</div>
    </div>
  );
}

export function LockedFixturePanel({
  homeTeam,
  awayTeam,
  homeId,
  awayId,
  isKnockout,
  realResult,
  myEntry,
  otherEntries,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const teamFor = (id: string | null) => teamName(id, homeId, awayId, homeTeam, awayTeam);

  const buildExtra = (p: Prediction | null): ReactNode => {
    if (!isKnockout || !p) return null;
    return <ExtraInfo et={p.et} pen={p.pen} qual={teamFor(p.qual)} />;
  };

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Column header */}
      <div
        className={`${ROW_CLS} border-b border-zinc-200 bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400`}
      >
        <span></span>
        <span className="truncate text-center font-semibold">{homeTeam}</span>
        <span></span>
        <span className="truncate text-center font-semibold">{awayTeam}</span>
        <span>{isKnockout ? "Detalles" : ""}</span>
        <span className="text-right">Pts</span>
      </div>

      {/* Real result */}
      {realResult ? (
        <Row
          label={<span className="text-amber-700 dark:text-amber-300">🏁 Real</span>}
          h={realResult.h}
          a={realResult.a}
          extra={
            isKnockout ? (
              <ExtraInfo
                et={realResult.et}
                pen={realResult.pen}
                qual={teamFor(realResult.qualifiedTeamId)}
              />
            ) : null
          }
          rightCell={null}
          accent="border-b border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20"
        />
      ) : (
        <p className="border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500 italic dark:border-zinc-800 dark:text-zinc-400">
          Aún sin resultado oficial confirmado.
        </p>
      )}

      {/* My prediction */}
      <Row
        label={
          <span>
            {myEntry.display_name}{" "}
            <span className="ml-1 rounded bg-sky-200 px-1.5 text-[10px] font-bold text-sky-800 uppercase dark:bg-sky-800 dark:text-sky-100">
              tú
            </span>
          </span>
        }
        h={myEntry.prediction?.h90 ?? "—"}
        a={myEntry.prediction?.a90 ?? "—"}
        extra={buildExtra(myEntry.prediction)}
        rightCell={
          <PointsCell
            score={myEntry.score}
            popoverLabel={`Mi desglose · ${homeTeam} vs ${awayTeam}`}
          />
        }
        accent="bg-sky-50/70 dark:bg-sky-950/20"
      />

      {/* Toggle others */}
      {otherEntries.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300 dark:hover:bg-zinc-900"
            aria-expanded={expanded}
          >
            <span>
              {expanded ? "Ocultar" : "Ver"} predicciones de otros ({otherEntries.length})
            </span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded && (
            <div className="border-t border-zinc-200 dark:border-zinc-800">
              {otherEntries.map((e, idx) => (
                <Row
                  key={e.user_id}
                  label={<span>{e.display_name}</span>}
                  h={e.prediction?.h90 ?? "—"}
                  a={e.prediction?.a90 ?? "—"}
                  extra={buildExtra(e.prediction)}
                  rightCell={
                    <PointsCell
                      score={e.score}
                      popoverLabel={`${e.display_name} · ${homeTeam} vs ${awayTeam}`}
                    />
                  }
                  accent={
                    idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50 dark:bg-zinc-950/40"
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
