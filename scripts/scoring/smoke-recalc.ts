/**
 * Smoke runner for `recalculateTournamentScoresCore`.
 *
 * Usage:
 *   npm run scoring:smoke                       # local only, default tournament
 *   npm run scoring:smoke -- --slug wc_2026     # different tournament
 *   npm run scoring:smoke -- --confirm-prod     # writes to remote (refuses otherwise)
 *
 * The script forces tsx-friendly URL resolution (LAN IP instead of 127.0.0.1)
 * via the same helper the wc2022 scripts use.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";
import { recalculateTournamentScoresCore } from "../../src/lib/scoring/recalculateCore";
import { assertSafeTarget, detectTarget } from "../wc2022/lib/env";
import { done, fatal, info, step } from "../wc2022/lib/log";

function parseSlug(): string {
  const idx = process.argv.indexOf("--slug");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG ?? "wc_2022_test";
}

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: true });

  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) fatal("SUPABASE_SECRET_KEY is not set");

  const slug = parseSlug();
  step("Tournament");
  info("slug", slug);

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
  info("id", tournament.id);
  info("name", tournament.name);

  step("Recalculating");
  const { inserted } = await recalculateTournamentScoresCore(supabase, tournament.id);
  done(`inserted ${inserted} prediction_scores rows`);

  step("Summary by prediction_type");
  const { data: summary, error: sErr } = await supabase
    .from("prediction_scores")
    .select("prediction_type, points_total")
    .eq("tournament_id", tournament.id);
  if (sErr) fatal(`summary lookup failed: ${sErr.message}`);
  const byType = new Map<string, { count: number; sum: number }>();
  for (const row of summary ?? []) {
    const k = row.prediction_type;
    const acc = byType.get(k) ?? { count: 0, sum: 0 };
    acc.count += 1;
    acc.sum += Number(row.points_total);
    byType.set(k, acc);
  }
  for (const [k, v] of byType) {
    info(k, `${v.count} rows, sum ${v.sum.toFixed(2)} pts`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
