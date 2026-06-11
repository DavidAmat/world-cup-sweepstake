/**
 * Record a confirmed real match result for one fixture (matched by external_id)
 * and recalculate the tournament's prediction_scores. Mirrors exactly what the
 * admin UI (/admin/results) does on "Confirmar": it upserts match_results and
 * fires a full recalc. Reuses the app's own deriveResult so group vs knockout
 * columns are filled identically.
 *
 * Only the 90' score is ever stored. Extra time and the official winner are
 * DERIVED, never trusted from input (same rule as the UI):
 *   - Group:    only home_goals_90 / away_goals_90 matter. Winner is null on a
 *               draw. No qualifier, no ET, no penalties.
 *   - Knockout: home_goals_90 / away_goals_90 is the score at 90'. If that is a
 *               draw, the match went to extra time (derived); you MUST say which
 *               team advanced with --qualified, and add --penalties if it was
 *               decided on penalties. If NOT a draw, the 90' winner advances and
 *               --qualified / --penalties are ignored.
 *
 * Goals (match_goals) are NOT entered here — they do not feed scoring (pichichi
 * / mejor jugador are admin-judged free text), so this script never touches them.
 *
 *   Local:  npm run wc2026:set-result -- --external-id=wc2026_md1_a_mex_rsa --home90=2 --away90=0
 *   Prod:   npm run wc2026:set-result:prod -- --external-id=wc2026_md1_a_mex_rsa --home90=2 --away90=0
 *
 *   Knockout draw (advances on penalties):
 *           ... --external-id=wc2026_r32_01 --home90=1 --away90=1 --qualified=home --penalties
 *   Knockout draw (advances in extra time, no penalties):
 *           ... --external-id=wc2026_r32_01 --home90=1 --away90=1 --qualified=away
 *
 *   Add --dry-run to preview the derived columns without writing.
 */
import { readFileSync } from "node:fs";
import { PATHS } from "./lib/paths";
import { PythonMatchesSchema, TournamentSchema } from "../lib/schemas";
import { assertSafeTarget, detectTarget } from "../lib/env";
import { createScriptAdminClient } from "../lib/supabase";
import { done, fatal, info, step, warn } from "../lib/log";
import { deriveResult, type MatchResultPayload } from "../../src/app/admin/results/schemas";
import { recalculateTournamentScoresCore } from "../../src/lib/scoring/recalculateCore";

type Args = {
  externalId: string;
  home90: number;
  away90: number;
  qualified?: "home" | "away";
  penalties: boolean;
  dryRun: boolean;
  noRecalc: boolean;
};

function parseArgs(): Args {
  const get = (name: string): string | undefined => {
    const a = process.argv.find((x) => x.startsWith(`--${name}=`));
    return a?.slice(`--${name}=`.length).trim();
  };

  const externalId = get("external-id");
  if (!externalId) fatal("Provide --external-id=<id> (e.g. wc2026_md1_a_mex_rsa).");

  const home90 = Number(get("home90"));
  const away90 = Number(get("away90"));
  if (!Number.isInteger(home90) || home90 < 0) fatal("Provide a valid --home90=<n> (integer ≥ 0).");
  if (!Number.isInteger(away90) || away90 < 0) fatal("Provide a valid --away90=<n> (integer ≥ 0).");

  const q = get("qualified");
  if (q !== undefined && q !== "home" && q !== "away") {
    fatal('--qualified must be "home" or "away".');
  }

  return {
    externalId: externalId!,
    home90,
    away90,
    qualified: q as "home" | "away" | undefined,
    penalties: process.argv.includes("--penalties"),
    dryRun: process.argv.includes("--dry-run"),
    noRecalc: process.argv.includes("--no-recalc"),
  };
}

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: true });

  const args = parseArgs();
  if (args.dryRun) warn("DRY RUN — no writes will be made");

  step("Loading seed JSON");
  const tournament = TournamentSchema.parse(JSON.parse(readFileSync(PATHS.tournamentJson, "utf8")));
  const matches = PythonMatchesSchema.parse(JSON.parse(readFileSync(PATHS.fixturesJson, "utf8")));
  const seed = matches.find((m) => m.external_id === args.externalId);
  if (!seed) fatal(`No fixture with external_id="${args.externalId}" in ${PATHS.fixturesJson}`);

  const isKnockout = seed!.tipo_partido === "eliminatoria";
  const drawAt90 = args.home90 === args.away90;

  info("tournament", tournament.slug);
  info("external_id", args.externalId);
  info("matchup (seed)", `${seed!.equipo_1} vs ${seed!.equipo_2}`);
  info("type", isKnockout ? "knockout (eliminatoria)" : "group (fase_grupos)");
  info("score 90'", `${args.home90}-${args.away90}`);

  // Guard the knockout-specific inputs before touching the DB.
  if (isKnockout && drawAt90 && !args.qualified) {
    fatal("Knockout drawn at 90': pass --qualified=home|away to say which team advanced.");
  }
  if (!isKnockout && args.qualified) {
    warn("--qualified ignored for a group match.");
  }
  if (args.penalties && !(isKnockout && drawAt90)) {
    fatal("--penalties is only valid for a knockout drawn at 90'.");
  }

  const supabase = createScriptAdminClient();

  step("Resolving tournament + fixture");
  const { data: tRow, error: tErr } = await supabase
    .from("tournaments")
    .select("id")
    .eq("slug", tournament.slug)
    .single();
  if (tErr || !tRow) fatal(`Tournament "${tournament.slug}" not found on this project`, tErr);
  const tournamentId = tRow!.id;

  const { data: fixture, error: fErr } = await supabase
    .from("fixtures")
    .select("id, home_team_id, away_team_id")
    .eq("tournament_id", tournamentId)
    .eq("external_id", args.externalId)
    .maybeSingle();
  if (fErr) fatal("Failed loading fixture", fErr);
  if (!fixture) fatal(`Fixture "${args.externalId}" not found on this project (seed it first).`);
  if (!fixture!.home_team_id || !fixture!.away_team_id) {
    fatal("Fixture has no teams assigned yet (set knockout pairings before entering a result).");
  }

  const homeTeamId = fixture!.home_team_id!;
  const awayTeamId = fixture!.away_team_id!;
  const qualifiedTeamId = args.qualified
    ? args.qualified === "home"
      ? homeTeamId
      : awayTeamId
    : null;

  // Build the same payload the UI would post, then run the app's deriveResult
  // so the persisted columns are identical to a /admin/results confirm.
  const payload: MatchResultPayload = {
    fixture_id: fixture!.id,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    is_knockout: isKnockout,
    home_goals_90: args.home90,
    away_goals_90: args.away90,
    went_penalties: args.penalties,
    qualified_team_id: qualifiedTeamId,
    goals: [],
  };
  const derived = deriveResult(payload);

  step("Derived match_results columns");
  info("went_extra_time", derived.went_extra_time);
  info("went_penalties", derived.went_penalties);
  info("winner_team_id", derived.winner_team_id ?? "null (draw)");
  info("qualified_team_id", derived.qualified_team_id ?? "null");
  info("penalty_winner_team_id", derived.penalty_winner_team_id ?? "null");

  if (args.dryRun) {
    step("Done (dry run)");
    done("no writes made");
    return;
  }

  step("Upserting confirmed result");
  const { error: upErr } = await supabase.from("match_results").upsert(
    {
      tournament_id: tournamentId,
      fixture_id: fixture!.id,
      home_goals_90: derived.home_goals_90,
      away_goals_90: derived.away_goals_90,
      went_extra_time: derived.went_extra_time,
      home_goals_120: derived.home_goals_120,
      away_goals_120: derived.away_goals_120,
      went_penalties: derived.went_penalties,
      penalty_winner_team_id: derived.penalty_winner_team_id,
      winner_team_id: derived.winner_team_id,
      qualified_team_id: derived.qualified_team_id,
      result_status: "confirmed",
    },
    { onConflict: "fixture_id" },
  );
  if (upErr) fatal("Failed upserting match_results", upErr);
  done("match_results confirmed");

  if (args.noRecalc) {
    warn("--no-recalc: skipping puntuaciones recalc (run the recalc step once after your batch).");
  } else {
    step("Recalculating prediction_scores (puntuaciones)");
    const { inserted } = await recalculateTournamentScoresCore(supabase, tournamentId);
    done("recalculated", inserted);
  }

  step("Done");
  done(`${args.externalId} → ${args.home90}-${args.away90} confirmed on ${target.url}`);
}

main().catch((err) => {
  fatal("set-result failed", err);
});
