import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCORING_RULES_V1 } from "@/lib/scoring/rules";
import type { ScoringRulesV1 } from "@/lib/scoring/types";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { setSubjectiveEvaluation } from "./actions";

type SearchParams = Promise<{ ok?: string; error?: string }>;

type Row = {
  user_id: string;
  display_name: string | null;
  initials: string | null;
  top_scorer_text: string | null;
  best_player_text: string | null;
  last_place_name: string | null;
  top_scorer_correct: boolean | null;
  best_player_correct: boolean | null;
  last_place_correct: boolean | null;
};

const FIELD_LABEL = {
  top_scorer_correct: "Pichichi",
  best_player_correct: "Mejor jugador",
  last_place_correct: "Último de la porra",
} as const;

type Field = keyof typeof FIELD_LABEL;

function StateBadge({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <span className="border-success-light bg-success-light text-success-fg inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
        ✓ Acierto
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="border-danger-light bg-danger-light text-danger-fg inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
        ✗ Fallo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600">
      Sin evaluar
    </span>
  );
}

function EvaluationButtons({
  userId,
  field,
  current,
}: {
  userId: string;
  field: Field;
  current: boolean | null;
}) {
  const buttons: { value: "true" | "false" | "null"; label: string; activeCls: string }[] = [
    {
      value: "true",
      label: "✓ Acierto",
      activeCls: "bg-success text-success-fg border-success",
    },
    {
      value: "false",
      label: "✗ Fallo",
      activeCls: "bg-danger text-danger-fg border-danger",
    },
    {
      value: "null",
      label: "Limpiar",
      activeCls: "bg-zinc-200 text-zinc-800 border-zinc-300",
    },
  ];

  const currentValue: "true" | "false" | "null" =
    current === true ? "true" : current === false ? "false" : "null";

  return (
    <div className="flex flex-wrap gap-1.5">
      {buttons.map((b) => {
        const isActive = b.value === currentValue;
        return (
          <form key={b.value} action={setSubjectiveEvaluation}>
            <input type="hidden" name="user_id" value={userId} />
            <input type="hidden" name="field" value={field} />
            <input type="hidden" name="value" value={b.value} />
            <SubmitButton
              disabled={isActive}
              className={
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition " +
                (isActive
                  ? `${b.activeCls} cursor-default`
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50")
              }
              aria-pressed={isActive}
              aria-label={`${FIELD_LABEL[field]}: marcar como ${b.label.toLowerCase()}`}
            >
              {b.label}
            </SubmitButton>
          </form>
        );
      })}
    </div>
  );
}

export default async function AdminEvaluacionesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const tournament = await getDefaultTournament();
  const params = await searchParams;
  const supabase = createAdminClient();

  const [profilesRes, predsRes, rulesRes] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, initials"),
    supabase
      .from("initial_predictions")
      .select(
        "user_id, top_scorer_text, best_player_text, last_place_user_id, top_scorer_correct, best_player_correct, last_place_correct",
      )
      .eq("tournament_id", tournament.id),
    supabase
      .from("scoring_rules")
      .select("rules")
      .eq("tournament_id", tournament.id)
      .eq("active", true)
      .maybeSingle(),
  ]);

  const profileByUser = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.user_id,
      { display_name: p.display_name, initials: p.initials },
    ]),
  );

  const rows: Row[] = (predsRes.data ?? [])
    .map((p) => {
      const prof = profileByUser.get(p.user_id);
      return {
        user_id: p.user_id,
        display_name: prof?.display_name ?? null,
        initials: prof?.initials ?? null,
        top_scorer_text: p.top_scorer_text,
        best_player_text: p.best_player_text,
        last_place_name: p.last_place_user_id
          ? (profileByUser.get(p.last_place_user_id)?.display_name ?? null)
          : null,
        top_scorer_correct: p.top_scorer_correct,
        best_player_correct: p.best_player_correct,
        last_place_correct: p.last_place_correct,
      };
    })
    .sort((a, b) =>
      (a.display_name ?? "").localeCompare(b.display_name ?? "", "es", { sensitivity: "base" }),
    );

  const rules: ScoringRulesV1 =
    (rulesRes.data?.rules as ScoringRulesV1 | null) ?? DEFAULT_SCORING_RULES_V1;
  const pichichiPts = rules.initial_predictions.top_scorer;
  const mvpPts = rules.initial_predictions.best_player;
  const lastPlacePts = rules.initial_predictions.last_place;

  return (
    <main className="mx-auto max-w-6xl p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Evaluaciones subjetivas</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Torneo: <strong className="text-zinc-700">{tournament.name}</strong>. Marca a mano qué
            participantes acertaron el <strong>pichichi</strong> ({pichichiPts} pts), el{" "}
            <strong>mejor jugador</strong> ({mvpPts} pts) y el{" "}
            <strong>último de la porra</strong> ({lastPlacePts} pts). Cada cambio recalcula las
            puntuaciones del torneo.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-zinc-500 underline hover:text-zinc-900">
          ← Volver a administración
        </Link>
      </div>

      {params.ok === "saved" && (
        <div
          role="alert"
          className="border-success-light bg-success-light text-success-fg mt-5 rounded-md border px-4 py-3 text-sm font-medium"
        >
          Evaluación guardada y puntuaciones recalculadas.
        </div>
      )}
      {params.error && (
        <div
          role="alert"
          className="border-danger-light bg-danger-light text-danger-fg mt-5 rounded-md border px-4 py-3 text-sm font-medium"
        >
          {decodeURIComponent(params.error)}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
        Acierto = se suman los puntos. Fallo o sin evaluar = 0 puntos (sin penalización). Cuando
        FIFA anuncie los premios oficiales, compara cada texto con el ganador real y marca acierto o
        fallo.
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          Aún no hay predicciones iniciales registradas para este torneo.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Participante
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Pichichi <span className="font-normal normal-case">({pichichiPts} pts)</span>
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Mejor jugador <span className="font-normal normal-case">({mvpPts} pts)</span>
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Último de la porra{" "}
                  <span className="font-normal normal-case">({lastPlacePts} pts)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.user_id}
                  className={
                    "border-t border-zinc-100 align-top " + (i % 2 === 1 ? "bg-zinc-50/40" : "")
                  }
                >
                  <td className="px-3 py-3">
                    <div className="font-medium text-zinc-900">{r.display_name ?? "—"}</div>
                    <div className="text-xs text-zinc-500">{r.initials ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-zinc-900">
                      {r.top_scorer_text?.trim() || (
                        <span className="text-zinc-400 italic">Sin predicción</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StateBadge value={r.top_scorer_correct} />
                    </div>
                    {r.top_scorer_text?.trim() && (
                      <div className="mt-2">
                        <EvaluationButtons
                          userId={r.user_id}
                          field="top_scorer_correct"
                          current={r.top_scorer_correct}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-zinc-900">
                      {r.best_player_text?.trim() || (
                        <span className="text-zinc-400 italic">Sin predicción</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StateBadge value={r.best_player_correct} />
                    </div>
                    {r.best_player_text?.trim() && (
                      <div className="mt-2">
                        <EvaluationButtons
                          userId={r.user_id}
                          field="best_player_correct"
                          current={r.best_player_correct}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-zinc-900">
                      {r.last_place_name?.trim() || (
                        <span className="text-zinc-400 italic">Sin predicción</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StateBadge value={r.last_place_correct} />
                    </div>
                    {r.last_place_name?.trim() && (
                      <div className="mt-2">
                        <EvaluationButtons
                          userId={r.user_id}
                          field="last_place_correct"
                          current={r.last_place_correct}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
