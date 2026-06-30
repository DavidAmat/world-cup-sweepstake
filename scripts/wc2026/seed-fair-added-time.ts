/**
 * Seed fair_added_time_goals from the curated stoppage-time ("al 90") goals
 * JSON, then rebuild the fair pipeline (fair_match_results +
 * fair_prediction_scores) — "La Porra Justa".
 *
 * Usage:
 *   npm run wc2026:fair-seed                # local only
 *   npm run wc2026:fair-seed:prod           # writes to remote (needs --confirm-prod)
 *
 * Source JSON: context/implementations/2026-06-30/fair_clasification.json
 * Each entry: { external_id, goles_en_90: [{ equipo, goles }] }.
 *
 * Resolution: external_id → fixtures row → its two teams. The "equipo" name is
 * matched (case-insensitive) against display_name / canonical_name / aliases of
 * the fixture's home or away team. The script refuses to write anything if any
 * entry cannot be resolved or exceeds the team's real 90' goals.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";
import { recalculateFairTournamentScoresCore } from "../../src/lib/scoring/fair/recalculateFairCore";
import { assertSafeTarget, detectTarget } from "../lib/env";
import { done, fatal, info, step, warn } from "../lib/log";

type FairEntry = {
  external_id: string;
  goles_en_90: { equipo: string; goles: number }[];
};

const JSON_PATH = resolve(
  process.cwd(),
  "context/implementations/2026-06-30/fair_clasification.json",
);

function parseSlug(): string {
  const idx = process.argv.indexOf("--slug");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG ?? "wc_2026";
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: true });

  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) fatal("SUPABASE_SECRET_KEY is not set");

  const slug = parseSlug();
  const entries: FairEntry[] = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  step("Source");
  info("file", JSON_PATH);
  info("entries", entries.length);

  const supabase = createClient<Database>(target.url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tournament, error: tErr } = await supabase
    .from("tournaments")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (tErr) fatal(`tournament lookup failed: ${tErr.message}`);
  if (!tournament) fatal(`tournament not found: ${slug}`);
  info("tournament", `${tournament.name} (${tournament.id})`);

  // Load fixtures + teams + confirmed results for resolution & validation.
  const [{ data: fixtures }, { data: teams }, { data: results }] = await Promise.all([
    supabase
      .from("fixtures")
      .select("id, external_id, home_team_id, away_team_id")
      .eq("tournament_id", tournament.id),
    supabase
      .from("teams")
      .select("id, display_name, canonical_name, aliases")
      .eq("tournament_id", tournament.id),
    supabase
      .from("match_results")
      .select("fixture_id, home_goals_90, away_goals_90, result_status")
      .eq("tournament_id", tournament.id),
  ]);

  const fixtureByExt = new Map((fixtures ?? []).map((f) => [f.external_id, f]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const resultByFixture = new Map((results ?? []).map((r) => [r.fixture_id, r]));

  const teamMatches = (teamId: string | null, equipo: string): boolean => {
    if (!teamId) return false;
    const t = teamById.get(teamId);
    if (!t) return false;
    const target = norm(equipo);
    const names = [t.display_name, t.canonical_name, ...((t.aliases as string[] | null) ?? [])];
    return names.some((n) => typeof n === "string" && norm(n) === target);
  };

  type Row = {
    tournament_id: string;
    fixture_id: string;
    team_id: string;
    goals: number;
  };
  const rows: Row[] = [];
  const errors: string[] = [];

  for (const entry of entries) {
    const fx = fixtureByExt.get(entry.external_id);
    if (!fx) {
      errors.push(`external_id not found: ${entry.external_id}`);
      continue;
    }
    const result = resultByFixture.get(fx.id);
    if (!result || result.result_status !== "confirmed") {
      warn(`${entry.external_id}: no confirmed result yet — added-time goals stored but unscored.`);
    }
    for (const g of entry.goles_en_90) {
      let teamId: string | null = null;
      if (teamMatches(fx.home_team_id, g.equipo)) teamId = fx.home_team_id;
      else if (teamMatches(fx.away_team_id, g.equipo)) teamId = fx.away_team_id;
      if (!teamId) {
        errors.push(`${entry.external_id}: cannot match team "${g.equipo}" to either side.`);
        continue;
      }
      if (!Number.isInteger(g.goles) || g.goles <= 0) {
        errors.push(`${entry.external_id}: invalid goles ${g.goles} for ${g.equipo}.`);
        continue;
      }
      // Validate against the real 90' goals (if a confirmed result exists).
      if (result && result.result_status === "confirmed") {
        const real90 = teamId === fx.home_team_id ? result.home_goals_90 : result.away_goals_90;
        if (g.goles > (real90 ?? 0)) {
          errors.push(
            `${entry.external_id}: ${g.equipo} added ${g.goles} > real 90' goals ${real90}.`,
          );
          continue;
        }
      }
      rows.push({
        tournament_id: tournament.id,
        fixture_id: fx.id,
        team_id: teamId,
        goals: g.goles,
      });
    }
  }

  if (errors.length > 0) {
    step("Resolution errors — nothing written");
    for (const e of errors) warn(e);
    fatal(`${errors.length} entries could not be resolved. Fix the data and re-run.`);
  }

  step("Upserting fair_added_time_goals");
  info("rows", rows.length);
  const { error: upErr } = await supabase
    .from("fair_added_time_goals")
    .upsert(rows, { onConflict: "fixture_id,team_id" });
  if (upErr) fatal(`upsert failed: ${upErr.message}`);

  step("Recalculating fair scores");
  const { fairResults, inserted } = await recalculateFairTournamentScoresCore(
    supabase,
    tournament.id,
  );
  done(`fair_match_results: ${fairResults}, fair_prediction_scores: ${inserted}`);
}

main().catch((err) => fatal("seed-fair-added-time failed", err));
