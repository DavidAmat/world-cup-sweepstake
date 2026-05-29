/**
 * Clean-slate the wc_2026 tournament before going to production.
 *
 * Keeps MASTER data (tournament, teams, players, stages, rounds, scoring_rules)
 * and the group-stage fixtures of Jornada 1/2/3. Deletes everything else:
 * all user-generated rows (predictions, scores, snapshots), all results/goals,
 * the knockout fixture placeholders, and every existing auth user (cascades to
 * profiles).
 *
 *   Local:  npm run wc2026:clean
 *   Prod:   npm run wc2026:clean:prod   (forwards --confirm-prod)
 *
 * Pair with `npm run wc2026:users` afterwards to create the real accounts.
 */
import { assertSafeTarget, detectTarget } from "../lib/env";
import { createScriptAdminClient } from "../lib/supabase";
import { done, fatal, info, step, warn } from "../lib/log";

const TOURNAMENT_SLUG = "wc_2026";

// Group-stage matchdays we keep. Everything else in `fixtures` is deleted.
const KEEP_ROUND_CODES = ["group_md1", "group_md2", "group_md3"] as const;

// FK-safe delete order for tournament-scoped child data (same ordering rationale
// as src/app/admin/reset/actions.ts, plus terms_acceptances).
const DELETE_ORDER = [
  "prediction_scores",
  "leaderboard_snapshots",
  "match_goals",
  "match_results",
  "match_predictions",
  "initial_predictions",
  "group_qualification_predictions",
  "terms_acceptances",
] as const;

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: true });

  const supabase = createScriptAdminClient();

  step("Resolving tournament");
  const { data: tournament, error: tErr } = await supabase
    .from("tournaments")
    .select("id, slug, name")
    .eq("slug", TOURNAMENT_SLUG)
    .single();
  if (tErr || !tournament) fatal(`Tournament '${TOURNAMENT_SLUG}' not found`, tErr);
  info("tournament", `${tournament.name} (${tournament.id})`);

  step("Deleting tournament-scoped data");
  for (const table of DELETE_ORDER) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("tournament_id", tournament.id);
    if (error) fatal(`Failed deleting ${table}`, error);
    done(table, count ?? 0);
  }

  step("Deleting non-group fixtures (knockout placeholders)");
  const { data: keepRounds, error: rErr } = await supabase
    .from("rounds")
    .select("id, code")
    .eq("tournament_id", tournament.id)
    .in("code", KEEP_ROUND_CODES as unknown as string[]);
  if (rErr) fatal("Failed loading rounds", rErr);
  const keepIds = (keepRounds ?? []).map((r) => r.id);
  info("kept round ids", keepIds.length);
  if (keepIds.length === 0)
    warn("No group_md rounds found — ALL fixtures would be deleted; aborting fixtures step");

  if (keepIds.length > 0) {
    const { error: fErr, count: fCount } = await supabase
      .from("fixtures")
      .delete({ count: "exact" })
      .eq("tournament_id", tournament.id)
      .not("round_id", "in", `(${keepIds.join(",")})`);
    if (fErr) fatal("Failed deleting knockout fixtures", fErr);
    done("fixtures deleted (knockout)", fCount ?? 0);

    const { count: remaining } = await supabase
      .from("fixtures")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournament.id);
    info("fixtures remaining (J1-J3)", remaining ?? 0);
  }

  step("Deleting all auth users (cascades to profiles)");
  let deletedUsers = 0;
  // listUsers paginates; keep pulling page 1 since each deletion shrinks the set.
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) fatal("Failed listing auth users", error);
    const users = data?.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      const { error: dErr } = await supabase.auth.admin.deleteUser(u.id);
      if (dErr) fatal(`Failed deleting auth user ${u.email ?? u.id}`, dErr);
      deletedUsers += 1;
    }
  }
  done("auth users deleted", deletedUsers);

  step("Done");
  info("Next", "run `npm run wc2026:users` to create the real accounts");
}

main().catch((err) => {
  fatal("clean-slate failed", err);
});
