import Link from "next/link";
import type { ReactNode } from "react";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { acceptTerms } from "./actions";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { CheckCircle2, ListChecks, ClipboardList, Lock, Check, X } from "lucide-react";

type SearchParams = Promise<{ error?: string; ok?: string }>;

export default async function RulesPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, ok } = await searchParams;
  const { userId, supabase } = await requireAuth();

  const { data: activeTournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let alreadyAccepted = false;
  if (activeTournament) {
    const { data: existing } = await supabase
      .from("terms_acceptances")
      .select("id")
      .eq("tournament_id", activeTournament.id)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    alreadyAccepted = !!existing;
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Normas y puntuación</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Lee las reglas y acepta antes de empezar a jugar.
        </p>
      </div>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="mb-8 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-zinc-800">Cómo funciona</h2>

        <div className="border-primary/20 bg-primary/5 flex gap-4 rounded-2xl border p-5">
          <div className="bg-primary/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <ListChecks className="text-primary h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Paso 1 — Predicciones iniciales</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Antes de que empiece el torneo: <strong>campeón</strong>,{" "}
              <strong>subcampeón</strong>, <strong>pichichi</strong>,{" "}
              <strong>mejor jugador</strong> y <strong>2 equipos que pasan por cada grupo</strong>.
              Se bloquean al comenzar el primer partido.
            </p>
          </div>
        </div>

        <div className="border-success/20 bg-success/5 flex gap-4 rounded-2xl border p-5">
          <div className="bg-success/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <ClipboardList className="text-success-fg h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Paso 2 — Predicciones de partidos</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Antes de cada jornada predice el <strong>marcador a 90&apos;</strong>. En
              eliminatorias, además indica si habrá <strong>prórroga</strong>,{" "}
              <strong>penaltis</strong> y qué <strong>equipo pasa</strong>. El admin bloquea la
              jornada antes del primer partido.
            </p>
          </div>
        </div>

        <div className="border-warning/20 bg-warning/5 flex gap-4 rounded-2xl border p-5">
          <div className="bg-warning/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Lock className="text-warning-fg h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Bloqueos y visibilidad</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Mientras una jornada esté <strong>abierta</strong>, solo tú ves tus predicciones. Al{" "}
              <strong>bloquearse</strong>, quedan congeladas y se hacen públicas para todos. Sin
              predicción = 0 puntos en ese partido.
            </p>
          </div>
        </div>
      </section>

      {/* ── Scoring examples 3×3 grid ────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-4 text-base font-semibold text-zinc-800">
          Sistema de puntuación — ejemplos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* ── Row 1: Group stage ── */}
          <ExCard
            title="Marcador exacto a 90′"
            phase="Grupos ×1"
            breakdown={[
              { label: "Ganador correcto", pts: 5, ok: true },
              { label: "Marcador exacto", pts: 10, ok: true },
            ]}
            base={15}
          >
            <MatchCmp
              realH={2}
              realA={1}
              predH={2}
              predA={1}
              homeFlag="🇪🇸"
              home="España"
              awayFlag="🇫🇷"
              away="Francia"
            />
          </ExCard>

          <ExCard
            title="Ganador + cercanía de goles"
            phase="Grupos ×1"
            breakdown={[
              { label: "Ganador correcto", pts: 5, ok: true },
              { label: "Local ±2 goles", pts: 1, ok: true },
              { label: "Visitante exacto (0-0)", pts: 3, ok: true },
            ]}
            base={9}
          >
            <MatchCmp
              realH={3}
              realA={0}
              predH={1}
              predA={0}
              homeFlag="🇧🇷"
              home="Brasil"
              awayFlag="🇩🇪"
              away="Alemania"
            />
          </ExCard>

          <ExCard
            title="Diferencia exacta de goles"
            phase="Grupos ×1"
            breakdown={[
              { label: "Ganador correcto", pts: 5, ok: true },
              { label: "Local ±1 gol", pts: 2, ok: true },
              { label: "Visitante ±1 gol", pts: 2, ok: true },
              { label: "Diferencia exacta (+2)", pts: 3, ok: true },
            ]}
            base={12}
          >
            <MatchCmp
              realH={3}
              realA={1}
              predH={2}
              predA={0}
              homeFlag="🇦🇷"
              home="Argentina"
              awayFlag="🇲🇽"
              away="México"
            />
          </ExCard>

          {/* ── Row 2: Knockout ── */}
          <ExCard
            title="Prórroga acertada (sin penaltis)"
            phase="R16 ×2"
            breakdown={[
              { label: "Empate correcto", pts: 5, ok: true },
              { label: "Marcador exacto", pts: 10, ok: true },
              { label: "Prórroga acertada", pts: 5, ok: true },
              { label: "Clasificado acertado", pts: 8, ok: true },
            ]}
            base={28}
            mult={2}
          >
            <MatchCmp
              realH={1}
              realA={1}
              predH={1}
              predA={1}
              homeFlag="🇵🇹"
              home="Portugal"
              awayFlag="🇪🇸"
              away="España"
              realExtra="ET ✓ · Pen ✗ · Pasa Portugal"
              predExtra="ET ✓ · Pen ✗ · Pasa Portugal"
            />
          </ExCard>

          <ExCard
            title="Penaltis + todo acertado"
            phase="R16 ×2"
            breakdown={[
              { label: "Empate correcto", pts: 5, ok: true },
              { label: "Marcador exacto", pts: 10, ok: true },
              { label: "Prórroga acertada", pts: 5, ok: true },
              { label: "Penaltis acertados", pts: 5, ok: true },
              { label: "Clasificado acertado", pts: 8, ok: true },
            ]}
            base={33}
            mult={2}
          >
            <MatchCmp
              realH={0}
              realA={0}
              predH={0}
              predA={0}
              homeFlag="🇫🇷"
              home="Francia"
              awayFlag="🇧🇷"
              away="Brasil"
              realExtra="ET ✓ · Pen ✓ · Pasa Francia"
              predExtra="ET ✓ · Pen ✓ · Pasa Francia"
            />
          </ExCard>

          <ExCard
            title="Fallo en el clasificado"
            phase="R16 ×2"
            breakdown={[
              { label: "Empate correcto", pts: 5, ok: true },
              { label: "Marcador exacto", pts: 10, ok: true },
              { label: "Prórroga acertada", pts: 5, ok: true },
              { label: "Clasificado (error)", pts: 8, ok: false },
            ]}
            base={20}
            mult={2}
          >
            <MatchCmp
              realH={1}
              realA={1}
              predH={1}
              predA={1}
              homeFlag="🇩🇪"
              home="Alemania"
              awayFlag="🇦🇷"
              away="Argentina"
              realExtra="Pasa: Alemania"
              predExtra="Pasa: Argentina ✗"
            />
          </ExCard>

          {/* ── Row 3: Multiplier + initials ── */}
          <ExCard
            title="Multiplicador — Final ×5"
            phase="Final ×5"
            breakdown={[
              { label: "Ganador correcto", pts: 5, ok: true },
              { label: "Marcador exacto", pts: 10, ok: true },
            ]}
            base={15}
            mult={5}
          >
            <MatchCmp
              realH={2}
              realA={1}
              predH={2}
              predA={1}
              homeFlag="🇧🇷"
              home="Brasil"
              awayFlag="🇦🇷"
              away="Argentina"
            />
          </ExCard>

          <ExCard
            title="Campeón y subcampeón"
            phase="Inicial"
            breakdown={[
              { label: "Campeón acertado", pts: 200, ok: true },
              { label: "Subcampeón acertado", pts: 150, ok: true },
            ]}
            base={350}
          >
            <div className="overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50 text-xs">
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <span className="w-7 shrink-0 text-right text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
                  Pred
                </span>
                <span>🥇 </span>
                <span className="font-medium text-zinc-700">🇧🇷 Brasil</span>
                <span className="text-zinc-300">·</span>
                <span>🥈 </span>
                <span className="font-medium text-zinc-700">🇦🇷 Argentina</span>
              </div>
              <div className="flex items-center gap-1.5 border-t border-zinc-100 px-2 py-1.5">
                <span className="w-7 shrink-0 text-right text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
                  Real
                </span>
                <span className="text-success-fg font-medium">
                  🇧🇷 Brasil ✓ · 🇦🇷 Argentina ✓
                </span>
              </div>
            </div>
          </ExCard>

          <ExCard
            title="Clasificados de grupo"
            phase="Inicial"
            breakdown={[
              { label: "España pasa (Grupo A)", pts: 25, ok: true },
              { label: "Francia — no pasó", pts: 25, ok: false },
            ]}
            base={25}
            note="25 pts por acierto · sin penalización por fallo"
          >
            <div className="overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50 text-xs">
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <span className="w-7 shrink-0 text-right text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
                  Pred
                </span>
                <span className="font-medium text-zinc-700">🇪🇸 España · 🇫🇷 Francia</span>
              </div>
              <div className="flex items-center gap-1.5 border-t border-zinc-100 px-2 py-1.5">
                <span className="w-7 shrink-0 text-right text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
                  Real
                </span>
                <span className="font-medium">
                  <span className="text-success-fg">🇪🇸 ✓</span>
                  <span className="text-zinc-300"> · </span>
                  <span className="text-zinc-400">🇩🇪 Alemania</span>
                  <span className="text-zinc-300"> · </span>
                  <span className="text-zinc-400">🇫🇷 ✗</span>
                </span>
              </div>
            </div>
          </ExCard>
        </div>
      </section>

      {/* ── Multiplier + initial predictions tables ───────────────────── */}
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:gap-6">
        <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Multiplicadores por fase
          </h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {(
                [
                  ["Fase de grupos", "×1"],
                  ["R32, R16, Cuartos, 3.º", "×2"],
                  ["Semifinales", "×3"],
                  ["Final", "×5"],
                ] as [string, string][]
              ).map(([fase, mult]) => (
                <tr key={fase} className="border-b border-zinc-100 last:border-0">
                  <td className="py-1.5 pr-4 text-zinc-700">{fase}</td>
                  <td className="py-1.5 text-right font-bold text-zinc-900">{mult}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Predicciones iniciales
          </h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {(
                [
                  ["Campeón acertado", "200 pts"],
                  ["Subcampeón acertado", "150 pts"],
                  ["Pichichi acertado", "100 pts"],
                  ["Mejor jugador", "100 pts"],
                  ["Equipo clasif. de grupo", "25 pts c/u"],
                ] as [string, string][]
              ).map(([label, pts]) => (
                <tr key={label} className="border-b border-zinc-100 last:border-0">
                  <td className="py-1.5 pr-4 text-zinc-700">{label}</td>
                  <td className="py-1.5 text-right font-semibold text-zinc-900">{pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Feedback banners ─────────────────────────────────────────── */}
      {error && <ErrorBanner message={error} className="mb-4" />}
      {ok && (
        <div className="border-success/30 bg-success/10 text-success-fg mb-4 flex items-center gap-3 rounded-xl border p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>
            ¡Normas aceptadas! Ya puedes jugar. Vuelve al{" "}
            <Link href="/" className="font-medium underline">
              inicio
            </Link>
            .
          </span>
        </div>
      )}

      {/* ── Accept section ────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        {!activeTournament ? (
          <p className="text-sm text-zinc-500">
            Aún no hay torneo activo. El administrador lo activará pronto.
          </p>
        ) : alreadyAccepted ? (
          <div className="text-success-fg flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Ya aceptaste las normas para <strong>{activeTournament.name}</strong>.{" "}
              <Link href="/" className="font-medium underline">
                Ir al inicio →
              </Link>
            </span>
          </div>
        ) : (
          <form action={acceptTerms}>
            <input type="hidden" name="tournamentId" value={activeTournament.id} />
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="confirmed"
                required
                className="accent-primary mt-0.5 h-4 w-4 rounded border-zinc-300"
              />
              <span className="text-sm leading-relaxed text-zinc-700">
                He leído y acepto las normas de la porra del{" "}
                <strong>{activeTournament.name}</strong>. Entiendo cómo funciona el sistema de
                predicciones y puntuación.
              </span>
            </label>
            <button
              type="submit"
              className="bg-primary mt-4 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90"
            >
              Acepto las normas y empiezo a jugar
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

// ── Helper components ────────────────────────────────────────────────────────

function GoalBox({ v }: { v: number }) {
  return (
    <span className="mx-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800 text-[11px] font-bold text-white">
      {v}
    </span>
  );
}

function MatchCmp({
  realH,
  realA,
  predH,
  predA,
  homeFlag,
  home,
  awayFlag,
  away,
  realExtra,
  predExtra,
}: {
  realH: number;
  realA: number;
  predH: number;
  predA: number;
  homeFlag: string;
  home: string;
  awayFlag: string;
  away: string;
  realExtra?: string;
  predExtra?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50 text-xs">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="w-7 shrink-0 text-right text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
          Real
        </span>
        <span className="shrink-0">{homeFlag}</span>
        <span className="min-w-0 truncate font-medium text-zinc-700">{home}</span>
        <GoalBox v={realH} />
        <span className="shrink-0 text-zinc-300">–</span>
        <GoalBox v={realA} />
        <span className="min-w-0 truncate font-medium text-zinc-700">{away}</span>
        <span className="shrink-0">{awayFlag}</span>
      </div>
      {realExtra && (
        <p className="pb-1 pl-10 pr-2 text-[10px] italic text-zinc-500">{realExtra}</p>
      )}
      <div className="flex items-center gap-1 border-t border-zinc-100 px-2 py-1.5">
        <span className="text-primary/60 w-7 shrink-0 text-right text-[9px] font-semibold uppercase tracking-wide">
          Pred
        </span>
        <span className="shrink-0">{homeFlag}</span>
        <span className="min-w-0 truncate font-medium text-zinc-700">{home}</span>
        <GoalBox v={predH} />
        <span className="shrink-0 text-zinc-300">–</span>
        <GoalBox v={predA} />
        <span className="min-w-0 truncate font-medium text-zinc-700">{away}</span>
        <span className="shrink-0">{awayFlag}</span>
      </div>
      {predExtra && (
        <p className="text-primary/60 pb-1 pl-10 pr-2 text-[10px] italic">{predExtra}</p>
      )}
    </div>
  );
}

function ExCard({
  title,
  phase,
  children,
  breakdown,
  base,
  mult = 1,
  note,
}: {
  title: string;
  phase: string;
  children: ReactNode;
  breakdown: { label: string; pts: number; ok: boolean }[];
  base: number;
  mult?: number;
  note?: string;
}) {
  const total = Math.round(base * mult);
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white p-3">
      <div className="flex items-start justify-between gap-1">
        <p className="text-[11px] font-semibold leading-tight text-zinc-800">{title}</p>
        <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
          {phase}
        </span>
      </div>

      {children}

      <div className="flex flex-col gap-0.5 border-t border-zinc-100 pt-2">
        {breakdown.map((b) => (
          <div
            key={b.label}
            className={`flex items-center justify-between gap-2 text-[11px] ${
              b.ok ? "text-success-fg" : "text-zinc-400"
            }`}
          >
            <span className="flex min-w-0 items-center gap-0.5">
              {b.ok ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <X className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">{b.label}</span>
            </span>
            <span className={`shrink-0 font-oswald font-semibold ${b.ok ? "" : "opacity-40"}`}>
              {b.pts > 0 ? `+${b.pts}` : "—"}
            </span>
          </div>
        ))}
        {note && <p className="mt-0.5 text-[10px] italic text-zinc-400">{note}</p>}
      </div>

      <div className="text-right text-sm font-bold text-zinc-900">
        {mult > 1 && (
          <span className="mr-1 text-xs font-normal text-zinc-400">
            {base} &times; {mult} =
          </span>
        )}
        {total} pts
      </div>
    </div>
  );
}
