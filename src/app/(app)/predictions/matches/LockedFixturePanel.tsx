"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BreakdownPopover } from "@/components/scoring/BreakdownPopover";
import { BreakdownTable } from "@/components/scoring/BreakdownTable";
import { PointsBar } from "@/components/scoring/PointsBar";

// 6-column grid that vertically aligns the home/away goals across the
// real result row, the current user's prediction and every ranking row.
// The "Pts" column is fixed width so the ⓘ popover lines up.
const ROW_CLS =
  "grid grid-cols-[minmax(140px,1.4fr)_2.5rem_0.6rem_2.5rem_minmax(180px,1.6fr)_4.5rem] items-center gap-2 px-3 py-1.5 text-sm";

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

// `bulkSignal` is a controlled "broadcast" from the parent form. Every
// time the user clicks the global "Mostrar/Ocultar todas las
// predicciones" button the parent bumps `n` and sets `open`. Each panel
// reacts via useEffect to apply that intent, while still allowing
// individual toggles in between broadcasts.
export type LockedBulkSignal = { open: boolean; n: number };

type Props = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeId: string;
  awayId: string;
  isKnockout: boolean;
  maxPoints: number;
  realResult: LockedRealResult | null;
  myEntry: LockedEntry;
  otherEntries: LockedEntry[];
  bulkSignal: LockedBulkSignal;
};

// Stable per-string hash. Used as a tiebreaker when several entries have
// the same points (e.g. no real result yet → all scores are null) so the
// order looks random but doesn't reshuffle between renders.
function pseudoHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

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
  // No `prediction_scores` row yet — the result hasn't been confirmed by
  // the admin. We display a flat "0 pts" so columns line up; there is no
  // breakdown to show in a popover.
  if (!score) {
    return <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">0 pts</span>;
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

// One row inside the expanded ranking. Same 6-col grid for vertical
// alignment, but adds a second sub-row with the horizontal points bar.
function RankingRow({
  position,
  entry,
  isMe,
  maxPoints,
  isKnockout,
  homeTeam,
  awayTeam,
  buildExtra,
  zebra,
}: {
  position: number;
  entry: LockedEntry;
  isMe: boolean;
  maxPoints: number;
  isKnockout: boolean;
  homeTeam: string;
  awayTeam: string;
  buildExtra: (p: Prediction | null) => ReactNode;
  zebra: boolean;
}) {
  const points = entry.score?.points ?? 0;
  const accent = isMe
    ? "bg-sky-50/70 dark:bg-sky-950/20"
    : zebra
      ? "bg-zinc-50 dark:bg-zinc-950/40"
      : "bg-white dark:bg-zinc-900";
  return (
    <div className={`border-t border-zinc-200 px-0 pt-1.5 pb-2 dark:border-zinc-800 ${accent}`}>
      <Row
        label={
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              {position}
            </span>
            <span className="truncate">{entry.display_name}</span>
            {isMe && (
              <span className="ml-0.5 rounded bg-sky-200 px-1 text-[10px] font-bold text-sky-800 uppercase dark:bg-sky-800 dark:text-sky-100">
                tú
              </span>
            )}
          </span>
        }
        h={entry.prediction?.h90 ?? "—"}
        a={entry.prediction?.a90 ?? "—"}
        extra={isKnockout ? buildExtra(entry.prediction) : null}
        rightCell={
          <PointsCell
            score={entry.score}
            popoverLabel={`${entry.display_name} · ${homeTeam} vs ${awayTeam}`}
          />
        }
      />
      <div className="mt-1 flex items-center gap-2 px-3">
        <div className="flex-1">
          <PointsBar value={points} max={maxPoints} />
        </div>
        <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
          {points} / {maxPoints}
        </span>
      </div>
    </div>
  );
}

export function LockedFixturePanel({
  fixtureId,
  homeTeam,
  awayTeam,
  homeId,
  awayId,
  isKnockout,
  maxPoints,
  realResult,
  myEntry,
  otherEntries,
  bulkSignal,
}: Props) {
  // Derived state: the panel follows the parent broadcast (`bulkSignal`)
  // unless the user has toggled it individually since that broadcast. We
  // remember the override along with the `n` it was set against, so a
  // new broadcast automatically supersedes it without needing useEffect.
  const [override, setOverride] = useState<{ open: boolean; n: number } | null>(null);
  const expanded = override && override.n === bulkSignal.n ? override.open : bulkSignal.open;
  const toggle = () => setOverride({ open: !expanded, n: bulkSignal.n });

  const teamFor = (id: string | null) => teamName(id, homeId, awayId, homeTeam, awayTeam);

  const buildExtra = (p: Prediction | null): ReactNode => {
    if (!isKnockout || !p) return null;
    return <ExtraInfo et={p.et} pen={p.pen} qual={teamFor(p.qual)} />;
  };

  // Ranking = my entry + everyone else, sorted desc by points. Tie-break
  // is a deterministic hash of fixtureId+user_id so fixtures without a
  // real result yet show participants in a pseudo-random order (a
  // different order per fixture, but stable between renders of the same
  // fixture — refreshing the page doesn't reshuffle).
  const ranking = useMemo(() => {
    const all: { entry: LockedEntry; isMe: boolean }[] = [
      { entry: myEntry, isMe: true },
      ...otherEntries.map((e) => ({ entry: e, isMe: false })),
    ];
    return all.sort((a, b) => {
      const ap = a.entry.score?.points ?? -1;
      const bp = b.entry.score?.points ?? -1;
      if (ap !== bp) return bp - ap;
      return pseudoHash(fixtureId + a.entry.user_id) - pseudoHash(fixtureId + b.entry.user_id);
    });
  }, [fixtureId, myEntry, otherEntries]);

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

      {/* My prediction (fixed on top) */}
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

      {/* Ranking dropdown */}
      {ranking.length > 0 && (
        <>
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300 dark:hover:bg-zinc-900"
            aria-expanded={expanded}
          >
            <span>
              {expanded ? "Ocultar" : "Ver"} ranking de este partido ({ranking.length})
            </span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded && (
            <div>
              {ranking.map((r, idx) => (
                <RankingRow
                  key={r.entry.user_id}
                  position={idx + 1}
                  entry={r.entry}
                  isMe={r.isMe}
                  maxPoints={maxPoints}
                  isKnockout={isKnockout}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  buildExtra={buildExtra}
                  zebra={idx % 2 === 1}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
