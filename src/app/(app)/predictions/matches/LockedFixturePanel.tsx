"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Flag } from "lucide-react";
import { TeamName } from "@/components/ui/TeamName";
import { BreakdownPopover } from "@/components/scoring/BreakdownPopover";
import { BreakdownTable } from "@/components/scoring/BreakdownTable";
import { PointsBar } from "@/components/scoring/PointsBar";

// 6-column grid: name | h-goal | separator | a-goal | extra | pts
// Wider pts column so "56 pts" fits on one line.
const ROW_CLS =
  "grid grid-cols-[minmax(140px,1.4fr)_2.5rem_0.6rem_2.5rem_minmax(160px,1.5fr)_6rem] items-center gap-2 px-3 py-1.5 text-sm";

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

function ExtraInfo({ et, pen, qual }: { et: boolean; pen: boolean; qual: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs text-zinc-600">
      {et ? "Prórroga" : "Sin prórroga"} · {pen ? "penaltis" : "sin penaltis"} · pasa{" "}
      <strong>{qual}</strong>
    </span>
  );
}

function ScoreBox({ value }: { value: number | string }) {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-lg font-bold text-white shadow-sm">
      {value}
    </span>
  );
}

function RealResultBanner({
  homeTeam,
  awayTeam,
  realResult,
  isKnockout,
  qualTeamName,
}: {
  homeTeam: string;
  awayTeam: string;
  realResult: LockedRealResult;
  isKnockout: boolean;
  qualTeamName: string;
}) {
  return (
    <div className="border-warning-light bg-warning-light/60 border-b px-4 py-3">
      <div className="flex items-center justify-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
          <TeamName name={homeTeam} className="justify-end text-sm font-semibold" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ScoreBox value={realResult.h} />
          <span className="text-sm font-bold text-zinc-400">—</span>
          <ScoreBox value={realResult.a} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <TeamName name={awayTeam} className="text-sm font-semibold" />
        </div>
      </div>
      {isKnockout && (
        <div className="mt-1.5 flex justify-center">
          <span className="bg-warning/20 text-warning-fg rounded-full px-3 py-0.5 text-xs">
            {realResult.et
              ? realResult.pen
                ? `Penaltis · pasa ${qualTeamName}`
                : `Prórroga · pasa ${qualTeamName}`
              : `Pasa ${qualTeamName} (90′)`}
          </span>
        </div>
      )}
      <p className="text-warning-fg/70 mt-1 text-center text-[10px] font-semibold tracking-wide uppercase">
        <Flag className="mr-1 inline h-3 w-3" aria-hidden />
        Resultado oficial
      </p>
    </div>
  );
}

function PointsCell({
  score,
  popoverLabel,
  popoverId,
  openId,
  onOpenChange,
}: {
  score: Score | null;
  popoverLabel: string;
  popoverId: string;
  openId: string | null;
  onOpenChange: (next: string | null) => void;
}) {
  if (!score) {
    return <span className="font-mono text-xs whitespace-nowrap text-zinc-500">0 pts</span>;
  }
  return (
    <BreakdownPopover
      pointsTotal={score.points}
      label={popoverLabel}
      isOpen={openId === popoverId}
      onToggle={(next) => onOpenChange(next ? popoverId : null)}
    >
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
  popoverId,
  openId,
  onOpenChange,
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
  popoverId: string;
  openId: string | null;
  onOpenChange: (next: string | null) => void;
}) {
  const points = entry.score?.points ?? 0;
  const accent = isMe ? "bg-info-light/70" : zebra ? "bg-zinc-50" : "bg-white";
  return (
    <div className={`border-t border-zinc-200 px-0 pt-1.5 pb-2 ${accent}`}>
      <Row
        label={
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-700">
              {position}
            </span>
            <span className="truncate">{entry.display_name}</span>
            {isMe && (
              <span className="bg-info-light text-info-fg ml-0.5 rounded px-1 text-[10px] font-bold uppercase">
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
            popoverId={popoverId}
            openId={openId}
            onOpenChange={onOpenChange}
          />
        }
      />
      <div className="mt-1 flex items-center gap-2 px-3">
        <div className="flex-1">
          <PointsBar value={points} max={maxPoints} />
        </div>
        <span className="font-mono text-[10px] whitespace-nowrap text-zinc-500">
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
  const [override, setOverride] = useState<{ open: boolean; n: number } | null>(null);
  const expanded = override && override.n === bulkSignal.n ? override.open : bulkSignal.open;
  const toggle = () => setOverride({ open: !expanded, n: bulkSignal.n });

  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

  const teamFor = (id: string | null) => teamName(id, homeId, awayId, homeTeam, awayTeam);

  const buildExtra = (p: Prediction | null): ReactNode => {
    if (!isKnockout || !p) return null;
    return <ExtraInfo et={p.et} pen={p.pen} qual={<TeamName name={teamFor(p.qual)} />} />;
  };

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
    <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Real result scoreboard */}
      {realResult ? (
        <RealResultBanner
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          realResult={realResult}
          isKnockout={isKnockout}
          qualTeamName={teamFor(realResult.qualifiedTeamId)}
        />
      ) : (
        <p className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-center text-xs text-zinc-500 italic">
          Aún sin resultado oficial confirmado.
        </p>
      )}

      {/* Column header */}
      <div
        className={`${ROW_CLS} border-b border-zinc-200 bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase`}
      >
        <span></span>
        <span className="flex justify-center font-semibold">
          <TeamName name={homeTeam} />
        </span>
        <span></span>
        <span className="flex justify-center font-semibold">
          <TeamName name={awayTeam} />
        </span>
        <span>{isKnockout ? "Detalles" : ""}</span>
        <span className="text-right">Pts</span>
      </div>

      {/* My prediction (fixed on top) */}
      <Row
        label={
          <span>
            {myEntry.display_name}{" "}
            <span className="bg-info-light text-info-fg ml-1 rounded px-1.5 text-[10px] font-bold uppercase">
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
            popoverId="me-fixed"
            openId={openPopoverId}
            onOpenChange={setOpenPopoverId}
          />
        }
        accent="bg-info-light/70"
      />

      {/* Ranking dropdown */}
      {ranking.length > 0 && (
        <>
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
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
                  popoverId={r.entry.user_id}
                  openId={openPopoverId}
                  onOpenChange={setOpenPopoverId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
