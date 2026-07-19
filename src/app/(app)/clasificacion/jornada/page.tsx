import { CheckCircle2, RefreshCw } from "lucide-react";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { loadLeaderboardData, buildByRound } from "@/lib/scoring/leaderboard";
import { avatarUrlMapFor } from "@/lib/profiles/avatars";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ClasificacionTabs } from "../Tabs";
import { recalculateClasificacion } from "../actions";
import { JornadaTable } from "./JornadaTable";

type SearchParams = Promise<{ ok?: string }>;

export default async function JornadaPage({ searchParams }: { searchParams: SearchParams }) {
  const { ok } = await searchParams;
  const { userId, supabase } = await requireAuth();
  const tournament = await getDefaultTournament();
  const data = await loadLeaderboardData(tournament.id);
  const { rounds, rows: matchRows, totalsByRound } = buildByRound(data);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();
  const isAdmin = profileData?.role === "admin";

  // Per-user initial-prediction scores from the `initial` row breakdown
  // (champion / runner_up / top_scorer / best_player). Group-qualification
  // points are summed across every gqp row for the user.
  type ExtraScore = {
    campeon: number;
    subcampeon: number;
    pichichi: number;
    mejor_jug: number;
    clasificados: number;
  };
  const extraByUser = new Map<string, ExtraScore>();
  const ensure = (uid: string): ExtraScore => {
    const cur = extraByUser.get(uid) ?? {
      campeon: 0,
      subcampeon: 0,
      pichichi: 0,
      mejor_jug: 0,
      clasificados: 0,
    };
    extraByUser.set(uid, cur);
    return cur;
  };
  for (const s of data.scores) {
    if (s.prediction_type === "initial") {
      const bd = s.points_breakdown as Record<string, unknown>;
      const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
      const e = ensure(s.user_id);
      e.campeon += num(bd.champion);
      e.subcampeon += num(bd.runner_up);
      e.pichichi += num(bd.top_scorer);
      e.mejor_jug += num(bd.best_player);
    } else if (s.prediction_type === "group_qualification") {
      ensure(s.user_id).clasificados += s.points_total;
    }
  }

  const rows = matchRows
    .map((r) => {
      const e = extraByUser.get(r.profile.user_id) ?? {
        campeon: 0,
        subcampeon: 0,
        pichichi: 0,
        mejor_jug: 0,
        clasificados: 0,
      };
      return {
        profile: r.profile,
        matchesTotal: r.total,
        campeon: e.campeon,
        subcampeon: e.subcampeon,
        pichichi: e.pichichi,
        mejor_jug: e.mejor_jug,
        clasificados: e.clasificados,
        grandTotal:
          r.total + e.campeon + e.subcampeon + e.pichichi + e.mejor_jug + e.clasificados,
        byRound: Object.fromEntries(r.byRound),
      };
    })
    .sort(
      (a, b) =>
        b.grandTotal - a.grandTotal ||
        a.profile.display_name.localeCompare(b.profile.display_name),
    );

  const totalsByExtra = {
    campeon: rows.reduce((sum, r) => sum + r.campeon, 0),
    subcampeon: rows.reduce((sum, r) => sum + r.subcampeon, 0),
    pichichi: rows.reduce((sum, r) => sum + r.pichichi, 0),
    mejor_jug: rows.reduce((sum, r) => sum + r.mejor_jug, 0),
    clasificados: rows.reduce((sum, r) => sum + r.clasificados, 0),
  };

  return (
    <main className="mx-auto w-full max-w-[100rem] px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clasificación por jornada</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Puntos que cada participante ha sacado en cada jornada o ronda con resultados
            confirmados. Pulsa el nombre de una jornada para ver los partidos.
          </p>
        </div>
        {isAdmin && (
          <form action={recalculateClasificacion}>
            <SubmitButton
              className="border-special/30 bg-special-light/40 text-special-fg hover:bg-special-light/60 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-70"
              title="Recalcula prediction_scores para todos los usuarios"
              pendingText="Calculando…"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Calcular puntuación
            </SubmitButton>
          </form>
        )}
      </div>

      <ClasificacionTabs active="jornada" />

      {ok === "recalculated" && (
        <div className="border-success/30 bg-success/10 text-success-fg mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>Puntuaciones recalculadas.</span>
        </div>
      )}

      {rounds.length === 0 ? (
        <p className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Todavía no hay jornadas con resultados confirmados.
        </p>
      ) : (
        <JornadaTable
          rows={rows}
          rounds={rounds}
          totalsByRound={Object.fromEntries(totalsByRound)}
          totalsByExtra={totalsByExtra}
          userId={userId}
          avatarUrlByUser={avatarUrlMapFor(data.profiles)}
        />
      )}

      <p className="mt-4 text-xs text-zinc-500">
        Solo se incluyen las jornadas con al menos un resultado confirmado. Pulsa el nombre de la
        jornada para abrir su comparativa partido a partido.
      </p>
    </main>
  );
}
