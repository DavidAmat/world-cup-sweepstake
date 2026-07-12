/**
 * Insert/overwrite one user's match prediction for a single fixture, matched
 * by external_id, on their behalf (e.g. a player who told the admin their
 * pick out-of-band because the round was already locked when they tried to
 * submit it themselves). Runs with the service-role client, so it bypasses
 * RLS and the round-lock check exactly like the admin UI's own actions do
 * (see src/app/(app)/predictions/matches/actions.ts) — no need to unlock the
 * round first.
 *
 * Reuses the app's own FixturePredictionSchema so the row we write passes
 * the identical validation the UI form would enforce.
 *
 *   Local:  npm run wc2026:set-user-prediction -- --user=Nona --external-id=wc2026_qf_01 --home90=2 --away90=1
 *   Prod:   npm run wc2026:set-user-prediction:prod -- --user=Nona --external-id=wc2026_qf_01 --home90=2 --away90=1
 *
 *   Knockout drawn at 90' (extra time, who advances):
 *           ... --external-id=wc2026_qf_03 --home90=2 --away90=2 --et --qualified=away
 *   Add --pen if it also went to penalties (implies --et).
 *
 *   Add --dry-run to preview without writing.
 */
import { PythonMatchesSchema } from "../lib/schemas";
import { readFileSync } from "node:fs";
import { PATHS } from "./lib/paths";
import { assertSafeTarget, detectTarget } from "../lib/env";
import { createScriptAdminClient } from "../lib/supabase";
import { done, fatal, info, step, warn } from "../lib/log";
import { FixturePredictionSchema } from "../../src/app/(app)/predictions/matches/schemas";
import { recalculateTournamentScoresCore } from "../../src/lib/scoring/recalculateCore";

type Args = {
  user: string;
  externalId: string;
  home90: number;
  away90: number;
  et: boolean;
  pen: boolean;
  qualified?: "home" | "away";
  dryRun: boolean;
  noRecalc: boolean;
};

function parseArgs(): Args {
  const get = (name: string): string | undefined => {
    const a = process.argv.find((x) => x.startsWith(`--${name}=`));
    return a?.slice(`--${name}=`.length).trim();
  };

  const user = get("user");
  if (!user) fatal("Provide --user=<display_name> (e.g. Nona).");
  const externalId = get("external-id");
  if (!externalId) fatal("Provide --external-id=<id> (e.g. wc2026_qf_01).");

  const home90 = Number(get("home90"));
  const away90 = Number(get("away90"));
  if (!Number.isInteger(home90) || home90 < 0) fatal("Provide a valid --home90=<n> (integer ≥ 0).");
  if (!Number.isInteger(away90) || away90 < 0) fatal("Provide a valid --away90=<n> (integer ≥ 0).");

  const q = get("qualified");
  if (q !== undefined && q !== "home" && q !== "away") {
    fatal('--qualified must be "home" or "away".');
  }

  return {
    user: user!,
    externalId: externalId!,
    home90,
    away90,
    et: process.argv.includes("--et"),
    pen: process.argv.includes("--pen"),
    qualified: q as "home" | "away" | undefined,
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
  const matches = PythonMatchesSchema.parse(JSON.parse(readFileSync(PATHS.fixturesJson, "utf8")));
  const seed = matches.find((m) => m.external_id === args.externalId);
  if (!seed) fatal(`No fixture with external_id="${args.externalId}" in ${PATHS.fixturesJson}`);
  const isKnockout = seed!.tipo_partido === "eliminatoria";

  info("user", args.user);
  info("external_id", args.externalId);
  info("matchup (seed)", `${seed!.equipo_1} vs ${seed!.equipo_2}`);
  info("type", isKnockout ? "knockout (eliminatoria)" : "group (fase_grupos)");
  info("score 90'", `${args.home90}-${args.away90}`);

  const supabase = createScriptAdminClient();

  step("Resolving tournament + fixture + user");
  const { data: tRow, error: tErr } = await supabase
    .from("tournaments")
    .select("id")
    .eq("slug", "wc_2026")
    .single();
  if (tErr || !tRow) fatal(`Tournament "wc_2026" not found on this project`, tErr);
  const tournamentId = tRow!.id;

  const { data: fixture, error: fErr } = await supabase
    .from("fixtures")
    .select("id, home_team_id, away_team_id")
    .eq("tournament_id", tournamentId)
    .eq("external_id", args.externalId)
    .maybeSingle();
  if (fErr) fatal("Failed loading fixture", fErr);
  if (!fixture) fatal(`Fixture "${args.externalId}" not found on this project.`);
  if (!fixture!.home_team_id || !fixture!.away_team_id) {
    fatal("Fixture has no teams assigned yet (pairings not generated).");
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .eq("display_name", args.user)
    .maybeSingle();
  if (pErr) fatal("Failed loading profile", pErr);
  if (!profile) fatal(`No profile with display_name="${args.user}" on this project.`);

  const homeTeamId = fixture!.home_team_id!;
  const awayTeamId = fixture!.away_team_id!;
  const qualifiedTeamId = args.qualified
    ? args.qualified === "home"
      ? homeTeamId
      : awayTeamId
    : null;

  const parsed = FixturePredictionSchema.safeParse({
    fixture_id: fixture!.id,
    is_knockout: isKnockout,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    home_goals_90: args.home90,
    away_goals_90: args.away90,
    predicts_extra_time: args.et,
    predicts_penalties: args.pen,
    predicted_qualified_team_id: qualifiedTeamId,
  });
  if (!parsed.success) {
    fatal("Prediction failed the app's own validation:\n" + parsed.error.issues.map((i) => i.message).join("\n"));
  }
  const p = parsed.data;

  step("Row to upsert");
  info("predicts_extra_time", p.predicts_extra_time);
  info("predicts_penalties", p.predicts_penalties);
  info("predicted_qualified_team_id", p.predicted_qualified_team_id ?? "null");

  if (args.dryRun) {
    step("Done (dry run)");
    done("no writes made");
    return;
  }

  step("Upserting match_predictions");
  const { error: upErr } = await supabase.from("match_predictions").upsert(
    {
      tournament_id: tournamentId,
      fixture_id: fixture!.id,
      user_id: profile!.user_id,
      home_goals_90: p.home_goals_90,
      away_goals_90: p.away_goals_90,
      predicts_extra_time: p.predicts_extra_time,
      home_goals_120: null,
      away_goals_120: null,
      predicts_penalties: p.predicts_penalties,
      predicted_winner_team_id: p.predicted_qualified_team_id,
      predicted_qualified_team_id: p.predicted_qualified_team_id,
    },
    { onConflict: "fixture_id,user_id" },
  );
  if (upErr) fatal("Failed upserting match_predictions", upErr);
  done("match_predictions saved");

  if (args.noRecalc) {
    warn("--no-recalc: skipping puntuaciones recalc (run the recalc step once after your batch).");
  } else {
    step("Recalculating prediction_scores (puntuaciones)");
    const { inserted } = await recalculateTournamentScoresCore(supabase, tournamentId);
    done("recalculated", inserted);
  }

  step("Done");
  done(`${args.user} → ${args.externalId} ${args.home90}-${args.away90} saved on ${target.url}`);
}

main().catch((err) => {
  fatal("set-user-match-prediction failed", err);
});
