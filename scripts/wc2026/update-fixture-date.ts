/**
 * Re-sync fixture kickoff dates from data/seeds/wc_2026/fixtures.json into the
 * fixtures table, matched by external_id. Use after editing a `fecha` in the
 * seed JSON to push that change to a Supabase project (the seeder only inserts
 * new fixtures; it is not the tool for "the date changed" edits).
 *
 * `fecha` is Madrid local time; it is converted to UTC with the same helper the
 * seeder and admin UI use (madridLocalToUtcIso) so kickoff_at stays consistent.
 * Only kickoff_at is written — teams, status, results, etc. are untouched.
 *
 * Pick the target with --external-id=<id> for one match, or --all to sync every
 * fixture present in the JSON.
 *
 *   Local:  npm run wc2026:fixture-date -- --external-id=wc2026_md1_a_mex_rsa
 *   Prod:   npm run wc2026:fixture-date:prod -- --external-id=wc2026_md1_a_mex_rsa
 *   All:    npm run wc2026:fixture-date:prod -- --all
 */
import { readFileSync } from "node:fs";
import { PATHS } from "./lib/paths";
import { PythonMatchesSchema, TournamentSchema, type PythonMatch } from "../lib/schemas";
import { madridLocalToUtcIso } from "../lib/maps";
import { assertSafeTarget, detectTarget } from "../lib/env";
import { createScriptAdminClient } from "../lib/supabase";
import { done, fatal, info, step, warn } from "../lib/log";

function parseArgs(): { externalId?: string; all: boolean; dryRun: boolean } {
  const all = process.argv.includes("--all");
  const dryRun = process.argv.includes("--dry-run");
  const arg = process.argv.find((a) => a.startsWith("--external-id="));
  const externalId = arg?.slice("--external-id=".length).trim();
  if (!all && !externalId) {
    fatal("Provide --external-id=<id> for one fixture, or --all to sync every fixture.");
  }
  return { externalId, all, dryRun };
}

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: true });

  const { externalId, all, dryRun } = parseArgs();
  if (dryRun) warn("DRY RUN — no writes will be made");

  step("Loading JSONs");
  const tournament = TournamentSchema.parse(JSON.parse(readFileSync(PATHS.tournamentJson, "utf8")));
  const matches = PythonMatchesSchema.parse(JSON.parse(readFileSync(PATHS.fixturesJson, "utf8")));

  let targets: PythonMatch[];
  if (all) {
    targets = matches;
  } else {
    const m = matches.find((x) => x.external_id === externalId);
    if (!m) fatal(`No fixture with external_id="${externalId}" in ${PATHS.fixturesJson}`);
    targets = [m];
  }
  info("tournament", tournament.slug);
  info("fixtures to sync", String(targets.length));

  const supabase = createScriptAdminClient();

  step("Resolving tournament");
  const { data: tRow, error: tErr } = await supabase
    .from("tournaments")
    .select("id")
    .eq("slug", tournament.slug)
    .single();
  if (tErr || !tRow) fatal(`Tournament "${tournament.slug}" not found on this project`, tErr);
  const tournamentId = tRow.id;

  step("Updating kickoff_at");
  let updated = 0;
  let missing = 0;
  let unchanged = 0;
  for (const m of targets) {
    const kickoffUtc = madridLocalToUtcIso(m.fecha);

    const { data: before } = await supabase
      .from("fixtures")
      .select("kickoff_at")
      .eq("tournament_id", tournamentId)
      .eq("external_id", m.external_id)
      .maybeSingle();

    if (!before) {
      warn(`not in DB, skipping: ${m.external_id}`);
      missing++;
      continue;
    }

    // Compare instants, not strings: Postgres returns "+00:00" while the helper
    // emits ".000Z", so equal times have different text representations.
    if (new Date(before.kickoff_at).getTime() === new Date(kickoffUtc).getTime()) {
      unchanged++;
      continue;
    }

    // Show every change so the diff is visible (in both dry-run and real runs).
    info("external_id", m.external_id);
    info("fecha (Madrid)", m.fecha);
    info("kickoff_at before (UTC)", before.kickoff_at);
    info("kickoff_at after  (UTC)", kickoffUtc);

    if (dryRun) {
      updated++;
      continue;
    }

    const { data: rows, error } = await supabase
      .from("fixtures")
      .update({ kickoff_at: kickoffUtc })
      .eq("tournament_id", tournamentId)
      .eq("external_id", m.external_id)
      .select("external_id");
    if (error) fatal(`Failed updating ${m.external_id}`, error);
    if (!rows || rows.length === 0) {
      warn(`no row updated: ${m.external_id}`);
      missing++;
      continue;
    }

    updated++;
  }

  step("Done");
  const verb = dryRun ? "would update" : "updated";
  done(`${verb}=${updated}  unchanged=${unchanged}  missing=${missing}`);
}

main().catch((err) => {
  fatal("update-fixture-date failed", err);
});
