"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateTournamentScores } from "@/lib/scoring/recalculate";
import type { ScoringRulesV1 } from "@/lib/scoring/types";
import type { Json } from "@/lib/supabase/database.types";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";

function parseRulesFromFormData(formData: FormData): ScoringRulesV1 {
  const num = (key: string) => Number(formData.get(key) ?? 0);
  return {
    version: 1,
    match: {
      correct_outcome_90: num("correct_outcome_90"),
      exact_score_90: num("exact_score_90"),
      home_goals_distance: {
        "0": num("home_goals_distance_0"),
        "1": num("home_goals_distance_1"),
        "2": num("home_goals_distance_2"),
      },
      away_goals_distance: {
        "0": num("away_goals_distance_0"),
        "1": num("away_goals_distance_1"),
        "2": num("away_goals_distance_2"),
      },
      goal_difference_exact: num("goal_difference_exact"),
    },
    knockout: {
      correct_extra_time: num("correct_extra_time"),
      correct_penalties: num("correct_penalties"),
      correct_qualified_team: num("correct_qualified_team"),
    },
    stage_multipliers: {
      group_stage: num("mult_group_stage"),
      round_of_32: num("mult_round_of_32"),
      round_of_16: num("mult_round_of_16"),
      quarter_final: num("mult_quarter_final"),
      semi_final: num("mult_semi_final"),
      third_place: num("mult_third_place"),
      final: num("mult_final"),
    },
    initial_predictions: {
      champion: num("init_champion"),
      runner_up: num("init_runner_up"),
      top_scorer: num("init_top_scorer"),
      best_player: num("init_best_player"),
    },
    group_qualification: {
      team_correct: num("gq_team_correct"),
    },
  };
}

export async function duplicateScoringRules(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();

  const sourceId = formData.get("source_id")?.toString();
  if (!sourceId) redirect("/admin/reglas?error=ID+de+origen+no+encontrado");

  const { data: source } = await supabase
    .from("scoring_rules")
    .select("tournament_id, rules, version")
    .eq("id", sourceId)
    .single();
  if (!source) redirect("/admin/reglas?error=Regla+de+origen+no+encontrada");

  const { data: existing } = await supabase
    .from("scoring_rules")
    .select("version")
    .eq("tournament_id", source.tournament_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const newVersion = (existing?.version ?? source.version) + 1;

  const { data: created } = await supabase
    .from("scoring_rules")
    .insert({
      tournament_id: source.tournament_id,
      version: newVersion,
      active: false,
      rules: source.rules as Json,
    })
    .select("id")
    .single();

  revalidatePath("/admin/reglas");
  redirect(`/admin/reglas?editing=${created?.id ?? ""}`);
}

export async function saveScoringRulesDraft(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();

  const ruleId = formData.get("rule_id")?.toString();
  if (!ruleId) redirect("/admin/reglas?error=ID+de+regla+no+encontrado");

  const { data: existing } = await supabase
    .from("scoring_rules")
    .select("active")
    .eq("id", ruleId)
    .single();

  if (existing?.active) {
    redirect("/admin/reglas?error=No+se+puede+editar+la+versi%C3%B3n+activa+directamente");
  }

  const rules = parseRulesFromFormData(formData);

  await supabase
    .from("scoring_rules")
    .update({ rules: rules as unknown as Json })
    .eq("id", ruleId)
    .eq("active", false);

  revalidatePath("/admin/reglas");
  redirect(`/admin/reglas?ok=saved&editing=${ruleId}`);
}

export async function activateScoringRules(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();

  const ruleId = formData.get("rule_id")?.toString();
  if (!ruleId) redirect("/admin/reglas?error=ID+de+regla+no+encontrado");

  const { data: rule } = await supabase
    .from("scoring_rules")
    .select("tournament_id")
    .eq("id", ruleId)
    .single();
  if (!rule) redirect("/admin/reglas?error=Regla+no+encontrada");

  await supabase
    .from("scoring_rules")
    .update({ active: false })
    .eq("tournament_id", rule.tournament_id)
    .neq("id", ruleId);

  await supabase.from("scoring_rules").update({ active: true }).eq("id", ruleId);

  revalidatePath("/admin/reglas");
  redirect("/admin/reglas?ok=activated");
}

export async function recalculateScoringRules() {
  await requireAdmin();

  const tournament = await getDefaultTournament();
  await recalculateTournamentScores(tournament.id);

  revalidatePath("/clasificacion", "layout");
  revalidatePath("/my-scores");
  revalidatePath("/admin/reglas");

  redirect("/admin/reglas?ok=recalculated");
}
