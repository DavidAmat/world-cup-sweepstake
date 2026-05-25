"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { TeamName } from "@/components/ui/TeamName";
import { NumberInput } from "@/components/ui/NumberInput";
import { formatMadridDateTime } from "@/lib/dates/madridTime";
import { Lock, Unlock, ChevronDown, Info } from "lucide-react";
import {
  saveAllMatchPredictions,
  lockRoundFromPredictions,
  unlockRoundFromPredictions,
} from "./actions";
import {
  LockedFixturePanel,
  type LockedBulkSignal,
  type LockedEntry,
  type LockedRealResult,
} from "./LockedFixturePanel";

export type SavedVM = {
  h90: number;
  a90: number;
  et: boolean;
  pen: boolean;
  qual: string | null;
};

export type ScoreVM = {
  points: number;
  breakdown: Record<string, unknown>;
};

export type FixtureVM = {
  id: string;
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  kickoff: string;
  isKnockout: boolean;
  locked: boolean;
  noTeams: boolean;
  maxPoints: number;
  saved: SavedVM | null;
  score: ScoreVM | null;
  realResult: LockedRealResult | null;
  otherEntries: LockedEntry[];
};

export type RoundVM = {
  id: string;
  code: string;
  name: string;
  locked: boolean;
  fixtures: FixtureVM[];
};

type Values = { h90: string; a90: string; et: boolean; pen: boolean; qual: string };

const GOAL_CLS =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 w-16 text-center font-oswald text-xl font-bold text-zinc-900 focus:border-primary focus:outline-none";

type Meta = { isKnockout: boolean; homeId: string; awayId: string };

// Extra time, penalties and the qualified team are derived from the 90'
// score for knockout fixtures, kept consistent with the server rules:
//  · draw at 90' ⇒ extra time (penalties optional, free winner).
//  · not a draw ⇒ no extra time; the team that advances is the 90' winner.
//  · group stage ⇒ none of these apply.
function derive(v: Values, m: Meta): Values {
  if (!m.isKnockout) return { ...v, et: false, pen: false, qual: "" };
  const both = v.h90 !== "" && v.a90 !== "";
  const draw = both && v.h90 === v.a90;
  const et = draw;
  const pen = et ? v.pen : false;
  let qual = v.qual;
  if (both && !draw) {
    qual = Number(v.h90) > Number(v.a90) ? m.homeId : m.awayId;
  }
  return { ...v, et, pen, qual };
}

function initial(f: FixtureVM): Values {
  const s = f.saved;
  const base: Values = {
    h90: s ? String(s.h90) : "",
    a90: s ? String(s.a90) : "",
    et: s?.et ?? false,
    pen: s?.pen ?? false,
    qual: s?.qual ?? "",
  };
  return derive(base, { isKnockout: f.isKnockout, homeId: f.homeId, awayId: f.awayId });
}

function isSaved(v: Values, s: SavedVM | null): boolean {
  if (!s) return false;
  return (
    v.h90 === String(s.h90) &&
    v.a90 === String(s.a90) &&
    v.et === s.et &&
    v.pen === s.pen &&
    (v.qual || "") === (s.qual ?? "")
  );
}

export function MatchesForm({
  rounds,
  myDisplayName,
  isAdmin = false,
  allTeams = [],
}: {
  rounds: RoundVM[];
  myDisplayName: string;
  isAdmin?: boolean;
  allTeams?: string[];
}) {
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredTeams = useMemo(
    () =>
      allTeams.filter(
        (t) => filterSearch.trim() === "" || t.toLowerCase().includes(filterSearch.toLowerCase()),
      ),
    [allTeams, filterSearch],
  );

  const filteredRounds = useMemo(() => {
    if (!teamFilter) return rounds;
    return rounds
      .map((r) => ({
        ...r,
        fixtures: r.fixtures.filter((f) => f.home === teamFilter || f.away === teamFilter),
      }))
      .filter((r) => r.fixtures.length > 0);
  }, [rounds, teamFilter]);

  const allFixtures = useMemo(() => rounds.flatMap((r) => r.fixtures), [rounds]);

  const [values, setValues] = useState<Record<string, Values>>(() => {
    const m: Record<string, Values> = {};
    for (const f of allFixtures) m[f.id] = initial(f);
    return m;
  });

  const metaById = useMemo(() => {
    const m: Record<string, Meta> = {};
    for (const f of allFixtures)
      m[f.id] = { isKnockout: f.isKnockout, homeId: f.homeId, awayId: f.awayId };
    return m;
  }, [allFixtures]);

  const set = (id: string, patch: Partial<Values>) =>
    setValues((prev) => ({
      ...prev,
      [id]: derive({ ...prev[id], ...patch }, metaById[id]),
    }));

  const savedById = useMemo(() => {
    const m: Record<string, SavedVM | null> = {};
    for (const f of allFixtures) m[f.id] = f.saved;
    return m;
  }, [allFixtures]);

  const unsavedCount = allFixtures.filter(
    (f) => !f.locked && !f.noTeams && !isSaved(values[f.id], savedById[f.id]),
  ).length;

  const lockedCount = allFixtures.filter((f) => f.locked && !f.noTeams).length;

  // Broadcast object for the per-fixture ranking dropdowns. Each click
  // on the global button bumps `n` so panels re-apply the intent even
  // if the user had previously toggled some of them individually.
  // Default is OPEN: once a round is locked we want every participant's
  // prediction visible by default (admin gates the lock manually), and
  // the user can collapse them with this button if they prefer the
  // compact view.
  const [bulkSignal, setBulkSignal] = useState<LockedBulkSignal>({ open: true, n: 0 });
  const toggleAll = () => setBulkSignal((s) => ({ open: !s.open, n: s.n + 1 }));

  const [, startRoundTransition] = useTransition();
  const handleLockRound = (roundCode: string) => {
    const fd = new FormData();
    fd.set("round", roundCode);
    startRoundTransition(() => lockRoundFromPredictions(fd));
  };
  const handleUnlockRound = (roundCode: string) => {
    const fd = new FormData();
    fd.set("round", roundCode);
    startRoundTransition(() => unlockRoundFromPredictions(fd));
  };

  return (
    <form action={saveAllMatchPredictions} className="mt-4">
      <div className="sticky top-14 z-10 -mx-6 border-b border-zinc-200 bg-white/90 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm">
              {unsavedCount === 0 ? (
                <span className="text-success-fg">Todo guardado ✓</span>
              ) : (
                <span className="text-warning-fg">
                  {unsavedCount} partido{unsavedCount === 1 ? "" : "s"} sin guardar
                </span>
              )}
            </p>

            {/* Team filter dropdown */}
            {allTeams.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {teamFilter ? teamFilter : "Filtrar selección"}
                  <ChevronDown className="h-3 w-3" aria-hidden />
                </button>
                {filterOpen && (
                  <div className="absolute top-full left-0 z-20 mt-1 w-56 rounded-xl border border-zinc-200 bg-white shadow-lg">
                    <div className="p-2">
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        className="focus:ring-primary w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTeamFilter("");
                          setFilterOpen(false);
                          setFilterSearch("");
                        }}
                        className={`w-full px-3 py-2 text-left text-xs hover:bg-zinc-100 ${!teamFilter ? "text-primary font-medium" : "text-zinc-600"}`}
                      >
                        Todas las selecciones
                      </button>
                      {filteredTeams.map((t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => {
                            setTeamFilter(t);
                            setFilterOpen(false);
                            setFilterSearch("");
                          }}
                          className={`w-full px-3 py-2 text-left text-xs hover:bg-zinc-100 ${teamFilter === t ? "text-primary font-medium" : "text-zinc-600"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {lockedCount > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {bulkSignal.open
                  ? "Ocultar todas las predicciones"
                  : "Mostrar todas las predicciones"}
              </button>
            )}
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Guardar predicciones
            </button>
          </div>
        </div>
        <nav className="mt-2 flex flex-wrap gap-1.5">
          {rounds.map((r) => (
            <a
              key={r.code}
              href={`#r-${r.code}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-zinc-100 ${
                r.locked
                  ? "border-danger/30 bg-danger/5 text-danger-fg"
                  : "border-zinc-300 text-zinc-600"
              }`}
            >
              {r.locked && <Lock className="h-2.5 w-2.5" aria-hidden />}
              {r.name}
            </a>
          ))}
        </nav>
      </div>

      <div className="mt-4 flex flex-col gap-8">
        {filteredRounds.map((r) => (
          <section key={r.code} id={`r-${r.code}`} className="scroll-mt-32">
            <div className="flex items-center justify-between gap-3 border-b-2 border-zinc-300 pb-1">
              <h2
                className={`flex items-center gap-2 text-lg font-bold ${r.locked ? "text-danger-fg" : ""}`}
              >
                {r.locked && <Lock className="h-4 w-4" aria-hidden />}
                {r.name}
                {r.locked && (
                  <span className="bg-danger/10 text-danger-fg border-danger/20 ml-1 rounded-full border px-2 py-0.5 text-xs font-semibold">
                    Bloqueado
                  </span>
                )}
              </h2>
              {isAdmin &&
                (r.locked ? (
                  <button
                    type="button"
                    onClick={() => handleUnlockRound(r.code)}
                    className="border-success/30 bg-success/10 text-success-fg hover:bg-success/20 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
                  >
                    <Unlock className="h-3 w-3" aria-hidden />
                    Desbloquear jornada
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleLockRound(r.code)}
                    className="border-danger/30 bg-danger/10 text-danger-fg hover:bg-danger/20 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
                  >
                    <Lock className="h-3 w-3" aria-hidden />
                    Bloquear jornada
                  </button>
                ))}
            </div>
            {r.fixtures.some((f) => f.isKnockout) && (
              <div className="border-info/30 bg-info-light/40 text-info-fg mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  La prórroga es automática: si predices empate a 90&apos; en eliminatoria, hay
                  prórroga. No se predice el resultado de la prórroga, solo si hay penaltis y qué
                  equipo pasa.
                </span>
              </div>
            )}
            <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {r.fixtures.map((f) => {
                const v = values[f.id];
                const status = f.locked ? "blocked" : isSaved(v, f.saved) ? "saved" : "unsaved";
                return (
                  <li
                    key={f.id}
                    className={`min-w-0 rounded-xl border bg-white p-3 transition-colors ${
                      f.locked ? "border-danger/20 bg-danger/5" : "border-zinc-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold">
                        <TeamName name={f.home} />
                        <span className="text-xs font-normal text-zinc-400">vs.</span>
                        <TeamName name={f.away} />
                        <span className="ml-1 text-xs font-normal whitespace-nowrap text-zinc-400">
                          {formatMadridDateTime(f.kickoff)}
                        </span>
                      </div>
                      {status === "blocked" ? (
                        <span className="bg-danger/10 text-danger-fg border-danger/20 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold">
                          <Lock className="h-3 w-3" aria-hidden />
                          Bloqueado
                        </span>
                      ) : status === "saved" ? (
                        <Badge tone="success">Guardado</Badge>
                      ) : (
                        <Badge tone="warning">Sin guardar</Badge>
                      )}
                    </div>

                    {f.noTeams ? (
                      <p className="mt-3 text-sm text-zinc-500">
                        ⏳ Equipos por definir — no se puede predecir todavía.
                      </p>
                    ) : f.locked ? (
                      <LockedFixturePanel
                        fixtureId={f.id}
                        homeTeam={f.home}
                        awayTeam={f.away}
                        homeId={f.homeId}
                        awayId={f.awayId}
                        isKnockout={f.isKnockout}
                        maxPoints={f.maxPoints}
                        realResult={f.realResult}
                        myEntry={{
                          user_id: "me",
                          display_name: myDisplayName,
                          prediction: f.saved,
                          score: f.score,
                        }}
                        otherEntries={f.otherEntries}
                        bulkSignal={bulkSignal}
                      />
                    ) : (
                      <Editable f={f} v={v} set={set} />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Guardar predicciones
        </button>
        <span className="text-xs text-zinc-500">
          Guarda todas las jornadas a la vez. Cada partido editado vuelve a &ldquo;Sin
          guardar&rdquo; (amarillo) hasta que pulses Guardar.
        </span>
      </div>
    </form>
  );
}

function Editable({
  f,
  v,
  set,
}: {
  f: FixtureVM;
  v: Values;
  set: (id: string, patch: Partial<Values>) => void;
}) {
  const bothEntered = v.h90 !== "" && v.a90 !== "";
  const draw = bothEntered && v.h90 === v.a90;
  const autoQualified = f.isKnockout && bothEntered && !draw;

  // Auto-width select: wraps an optionally-disabled native <select> with just
  // enough width to show its current text. We do it with a hidden twin <span>
  // that mirrors the selected text, kept off-screen but in DOM flow.
  const SELECT_BASE = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="mt-3 flex flex-col gap-3">
      {/* Score inputs: give each team name a fixed min-width so long names
          like "Costa de Marfil" don't create a new line. */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <TeamName name={f.home} flagOnly className="h-5" />
        <NumberInput
          name={`h90_${f.id}`}
          value={v.h90}
          onChange={(val) => set(f.id, { h90: val })}
          className={GOAL_CLS}
          ariaLabel={`Goles ${f.home} a 90'`}
        />
        <span className="text-zinc-400">—</span>
        <NumberInput
          name={`a90_${f.id}`}
          value={v.a90}
          onChange={(val) => set(f.id, { a90: val })}
          className={GOAL_CLS}
          ariaLabel={`Goles ${f.away} a 90'`}
        />
        <TeamName name={f.away} flagOnly className="h-5" />
      </div>

      {f.isKnockout && (
        <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          {v.et && <input type="hidden" name={`et_${f.id}`} value="1" />}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={v.et}
              disabled
              readOnly
              className="h-4 w-4"
              aria-label="Habrá prórroga (automático)"
            />
            <span className={v.et ? "" : "text-zinc-400"}>
              Habrá prórroga {v.et ? "(empate a 90′ → sí)" : "(automático)"}
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name={`pen_${f.id}`}
              checked={v.pen}
              disabled={!v.et}
              onChange={(e) => set(f.id, { pen: e.target.checked })}
              className="h-4 w-4"
            />
            <span className={v.et ? "" : "text-zinc-400"}>Se decide en los penaltis</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Equipo que pasa</span>
            {autoQualified ? (
              <>
                <input type="hidden" name={`qual_${f.id}`} value={v.qual} />
                <select value={v.qual} disabled className={`${SELECT_BASE} w-auto max-w-[220px]`}>
                  <option value={f.homeId}>{f.home}</option>
                  <option value={f.awayId}>{f.away}</option>
                </select>
                <span className="text-xs text-zinc-500">
                  Automático: pasa el ganador a 90&apos;.
                </span>
              </>
            ) : (
              <>
                <select
                  name={`qual_${f.id}`}
                  value={v.qual}
                  onChange={(e) => set(f.id, { qual: e.target.value })}
                  className={`${SELECT_BASE} w-auto max-w-[220px]`}
                >
                  <option value="">— Sin elegir —</option>
                  <option value={f.homeId}>{f.home}</option>
                  <option value={f.awayId}>{f.away}</option>
                </select>
                <span className="text-xs text-zinc-500">
                  Empate: elige tú qué equipo pasa (prórroga/penaltis).
                </span>
              </>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
