import type { Database } from "../../../src/lib/supabase/database.types";
import { ROUNDS, STAGES, type RoundCode, type StageCode } from "./catalogs";
import { madridLocalToUtcIso, resolveRound, resolveStage, type Fase } from "./maps";
import type { PythonMatch, TeamInput, TournamentInput } from "./schemas";
import { done, info, step, warn } from "./log";
import type { AdminSupabase } from "./supabase";

type TournamentRow = Database["public"]["Tables"]["tournaments"]["Row"];
type StageRow = Database["public"]["Tables"]["stages"]["Row"];
type RoundRow = Database["public"]["Tables"]["rounds"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type FixtureRow = Database["public"]["Tables"]["fixtures"]["Row"];

export async function upsertTournament(
  supabase: AdminSupabase,
  input: TournamentInput,
): Promise<TournamentRow> {
  step("tournament");
  const { data, error } = await supabase
    .from("tournaments")
    .upsert(input, { onConflict: "slug" })
    .select()
    .single();
  if (error) throw new Error(`upsertTournament: ${error.message}`);
  done(`tournament ${data.slug}`);
  return data;
}

export async function upsertStages(
  supabase: AdminSupabase,
  tournamentId: string,
): Promise<Map<StageCode, StageRow>> {
  step("stages");
  const rows = STAGES.map((s) => ({
    tournament_id: tournamentId,
    code: s.code,
    name: s.name,
    sort_order: s.sort_order,
    score_multiplier: s.score_multiplier,
  }));
  const { data, error } = await supabase
    .from("stages")
    .upsert(rows, { onConflict: "tournament_id,code" })
    .select();
  if (error) throw new Error(`upsertStages: ${error.message}`);
  done("stages", data.length);
  const byCode = new Map<StageCode, StageRow>();
  for (const row of data) byCode.set(row.code as StageCode, row);
  return byCode;
}

export async function upsertRounds(
  supabase: AdminSupabase,
  tournamentId: string,
  stagesByCode: Map<StageCode, StageRow>,
): Promise<Map<RoundCode, RoundRow>> {
  step("rounds");
  const rows = ROUNDS.map((r) => {
    const stage = stagesByCode.get(r.stage_code);
    if (!stage) throw new Error(`Stage ${r.stage_code} not found while building rounds`);
    return {
      tournament_id: tournamentId,
      code: r.code,
      name: r.name,
      stage_id: stage.id,
      sort_order: r.sort_order,
    };
  });
  const { data, error } = await supabase
    .from("rounds")
    .upsert(rows, { onConflict: "tournament_id,code" })
    .select();
  if (error) throw new Error(`upsertRounds: ${error.message}`);
  done("rounds", data.length);
  const byCode = new Map<RoundCode, RoundRow>();
  for (const row of data) byCode.set(row.code as RoundCode, row);
  return byCode;
}

export async function upsertTeams(
  supabase: AdminSupabase,
  tournamentId: string,
  teams: TeamInput[],
): Promise<TeamRow[]> {
  step("teams");
  const rows = teams.map((t) => ({
    tournament_id: tournamentId,
    external_id: t.external_id,
    code: t.code,
    canonical_name: t.canonical_name,
    display_name: t.display_name,
    aliases: t.aliases,
    group_code: t.group_code,
  }));
  const { data, error } = await supabase
    .from("teams")
    .upsert(rows, { onConflict: "tournament_id,external_id" })
    .select();
  if (error) throw new Error(`upsertTeams: ${error.message}`);
  done("teams", data.length);
  return data;
}

type FixtureContext = {
  stagesByCode: Map<StageCode, StageRow>;
  roundsByCode: Map<RoundCode, RoundRow>;
  teamsByName: Map<string, TeamRow>;
};

export async function upsertFixtures(
  supabase: AdminSupabase,
  tournamentId: string,
  matches: PythonMatch[],
  ctx: FixtureContext,
): Promise<{ inserted: FixtureRow[]; skipped: number }> {
  step("fixtures");

  const rows: Database["public"]["Tables"]["fixtures"]["Insert"][] = [];
  let skipped = 0;
  const skippedReasons: string[] = [];

  // Knockout fixtures without assigned teams come from the seed with the
  // literal string "TBD" on both sides; we insert them with a placeholder
  // instead of a team_id. The admin assigns real teams later via the
  // "Generar cruces" UI button.
  const PLACEHOLDER = "TBD";

  for (const match of matches) {
    const homeIsPlaceholder = match.equipo_1 === PLACEHOLDER;
    const awayIsPlaceholder = match.equipo_2 === PLACEHOLDER;

    const homeTeam = homeIsPlaceholder ? null : ctx.teamsByName.get(match.equipo_1);
    const awayTeam = awayIsPlaceholder ? null : ctx.teamsByName.get(match.equipo_2);

    if ((!homeIsPlaceholder && !homeTeam) || (!awayIsPlaceholder && !awayTeam)) {
      skipped++;
      skippedReasons.push(
        `${match.external_id} (${match.equipo_1} vs ${match.equipo_2}): team not in master data`,
      );
      continue;
    }

    const stage = ctx.stagesByCode.get(resolveStage(match.fase as Fase));
    if (!stage) throw new Error(`stage missing for ${match.external_id}`);
    const round = ctx.roundsByCode.get(resolveRound(match.fase as Fase, match.jornada));
    if (!round) throw new Error(`round missing for ${match.external_id}`);

    rows.push({
      tournament_id: tournamentId,
      external_id: match.external_id,
      stage_id: stage.id,
      round_id: round.id,
      group_code: match.grupo,
      home_team_id: homeTeam?.id ?? null,
      away_team_id: awayTeam?.id ?? null,
      home_placeholder: homeIsPlaceholder ? PLACEHOLDER : null,
      away_placeholder: awayIsPlaceholder ? PLACEHOLDER : null,
      kickoff_at: madridLocalToUtcIso(match.fecha),
      venue: null,
      status: "scheduled",
    });
  }

  info("matches in JSON", matches.length);
  info("matches to upsert", rows.length);
  info("skipped", skipped);

  if (skipped > 0) {
    for (const reason of skippedReasons) warn(reason);
  }

  if (rows.length === 0) {
    return { inserted: [], skipped };
  }

  const { data, error } = await supabase
    .from("fixtures")
    .upsert(rows, { onConflict: "tournament_id,external_id" })
    .select();
  if (error) throw new Error(`upsertFixtures: ${error.message}`);

  done("fixtures", data.length);
  return { inserted: data, skipped };
}
