"use client";

import { NumberInput } from "@/components/ui/NumberInput";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { saveScoringRulesDraft } from "./actions";
import type { ScoringRulesV1 } from "@/lib/scoring/types";

type Props = {
  ruleId: string;
  defaultValues: ScoringRulesV1;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-zinc-200 p-4">
      <legend className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {title}
      </legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function NumInput({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <NumberInput
        name={name}
        defaultValue={defaultValue}
        max={9999}
        required
        className="focus:border-primary focus:ring-primary-light font-oswald w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-base font-semibold outline-none focus:ring-2"
      />
    </label>
  );
}

export function RulesEditor({ ruleId, defaultValues: d }: Props) {
  return (
    <form action={saveScoringRulesDraft} className="mt-4 space-y-4">
      <input type="hidden" name="rule_id" value={ruleId} />

      <Section title="Partido (90')">
        <NumInput
          label="Resultado correcto a 90'"
          name="correct_outcome_90"
          defaultValue={d.match.correct_outcome_90}
        />
        <NumInput
          label="Marcador exacto a 90'"
          name="exact_score_90"
          defaultValue={d.match.exact_score_90}
        />
        <NumInput
          label="Distancia goles local — 0"
          name="home_goals_distance_0"
          defaultValue={d.match.home_goals_distance["0"]}
        />
        <NumInput
          label="Distancia goles local — 1"
          name="home_goals_distance_1"
          defaultValue={d.match.home_goals_distance["1"]}
        />
        <NumInput
          label="Distancia goles local — 2"
          name="home_goals_distance_2"
          defaultValue={d.match.home_goals_distance["2"]}
        />
        <NumInput
          label="Distancia goles visitante — 0"
          name="away_goals_distance_0"
          defaultValue={d.match.away_goals_distance["0"]}
        />
        <NumInput
          label="Distancia goles visitante — 1"
          name="away_goals_distance_1"
          defaultValue={d.match.away_goals_distance["1"]}
        />
        <NumInput
          label="Distancia goles visitante — 2"
          name="away_goals_distance_2"
          defaultValue={d.match.away_goals_distance["2"]}
        />
        <NumInput
          label="Diferencia de goles exacta"
          name="goal_difference_exact"
          defaultValue={d.match.goal_difference_exact}
        />
      </Section>

      <Section title="Eliminatorias">
        <NumInput
          label="Prórroga correcta"
          name="correct_extra_time"
          defaultValue={d.knockout.correct_extra_time}
        />
        <NumInput
          label="Penaltis correctos"
          name="correct_penalties"
          defaultValue={d.knockout.correct_penalties}
        />
        <NumInput
          label="Equipo clasificado correcto"
          name="correct_qualified_team"
          defaultValue={d.knockout.correct_qualified_team}
        />
      </Section>

      <Section title="Multiplicadores por fase">
        <NumInput
          label="Fase de grupos"
          name="mult_group_stage"
          defaultValue={d.stage_multipliers.group_stage}
        />
        <NumInput
          label="Treintaidosavos (R32)"
          name="mult_round_of_32"
          defaultValue={d.stage_multipliers.round_of_32}
        />
        <NumInput
          label="Octavos (R16)"
          name="mult_round_of_16"
          defaultValue={d.stage_multipliers.round_of_16}
        />
        <NumInput
          label="Cuartos de final"
          name="mult_quarter_final"
          defaultValue={d.stage_multipliers.quarter_final}
        />
        <NumInput
          label="Semifinal"
          name="mult_semi_final"
          defaultValue={d.stage_multipliers.semi_final}
        />
        <NumInput
          label="Tercer y cuarto puesto"
          name="mult_third_place"
          defaultValue={d.stage_multipliers.third_place}
        />
        <NumInput label="Final" name="mult_final" defaultValue={d.stage_multipliers.final} />
      </Section>

      <Section title="Predicciones iniciales">
        <NumInput
          label="Campeón"
          name="init_champion"
          defaultValue={d.initial_predictions.champion}
        />
        <NumInput
          label="Subcampeón"
          name="init_runner_up"
          defaultValue={d.initial_predictions.runner_up}
        />
        <NumInput
          label="Pichichi"
          name="init_top_scorer"
          defaultValue={d.initial_predictions.top_scorer}
        />
        <NumInput
          label="Mejor jugador (MVP)"
          name="init_best_player"
          defaultValue={d.initial_predictions.best_player}
        />
        <NumInput
          label="Último de la porra (MVP)"
          name="init_last_place"
          defaultValue={d.initial_predictions.last_place}
        />
      </Section>

      <Section title="Clasificados de grupo">
        <NumInput
          label="Equipo correcto clasificado"
          name="gq_team_correct"
          defaultValue={d.group_qualification.team_correct}
        />
      </Section>

      <div className="flex justify-end">
        <SubmitButton
          className="bg-primary text-primary-fg focus-visible:ring-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-70"
          pendingText="Guardando…"
        >
          Guardar borrador
        </SubmitButton>
      </div>
    </form>
  );
}
