/**
 * Seeder for the wc_2026 tournament (48 teams in 12 groups, 104 fixtures
 * = 72 group matches + 32 knockout placeholders).
 *
 * Mirrors scripts/wc2022/upload.ts and shares the same lib/. The only
 * tournament-specific bit is which JSON files we read; everything else
 * (upserts, schemas, env detection) is identical to wc2022.
 */
import { readFileSync } from "node:fs";
import { PATHS } from "./lib/paths";
import { PythonMatchesSchema, TeamsSchema, TournamentSchema } from "../wc2022/lib/schemas";
import { assertSafeTarget, detectTarget } from "../wc2022/lib/env";
import { createScriptAdminClient } from "../wc2022/lib/supabase";
import { fatal, info, step } from "../wc2022/lib/log";
import {
  upsertFixtures,
  upsertRounds,
  upsertScoringRulesV1,
  upsertStages,
  upsertTeams,
  upsertTournament,
} from "../wc2022/lib/upserts";

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: true });

  step("Loading JSONs");
  const tournament = TournamentSchema.parse(JSON.parse(readFileSync(PATHS.tournamentJson, "utf8")));
  const teams = TeamsSchema.parse(JSON.parse(readFileSync(PATHS.teamsJson, "utf8")));
  const matches = PythonMatchesSchema.parse(JSON.parse(readFileSync(PATHS.fixturesJson, "utf8")));
  info("tournament", tournament.slug);
  info("teams", teams.length);
  info("matches", matches.length);

  const supabase = createScriptAdminClient();

  const tournamentRow = await upsertTournament(supabase, tournament);
  await upsertScoringRulesV1(supabase, tournamentRow.id);
  const stagesByCode = await upsertStages(supabase, tournamentRow.id);
  const roundsByCode = await upsertRounds(supabase, tournamentRow.id, stagesByCode);
  const teamRows = await upsertTeams(supabase, tournamentRow.id, teams);

  const teamsByName = new Map<string, (typeof teamRows)[number]>();
  for (const row of teamRows) {
    teamsByName.set(row.display_name, row);
    teamsByName.set(row.canonical_name, row);
    if (Array.isArray(row.aliases)) {
      for (const alias of row.aliases as string[]) teamsByName.set(alias, row);
    }
  }

  const fixturesResult = await upsertFixtures(supabase, tournamentRow.id, matches, {
    stagesByCode,
    roundsByCode,
    teamsByName,
  });

  step("Done");
  info("tournament", tournamentRow.slug);
  info("stages", stagesByCode.size);
  info("rounds", roundsByCode.size);
  info("teams", teamRows.length);
  info("fixtures inserted", fixturesResult.inserted.length);
  info("fixtures skipped (no team match)", fixturesResult.skipped);
}

main().catch((err) => {
  fatal("upload failed", err);
});
