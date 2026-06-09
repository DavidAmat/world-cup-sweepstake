/**
 * Permanently DELETE a single account from Supabase Auth, by email.
 *
 * Deleting the auth user cascades through the schema:
 *   - REMOVED (on delete cascade): the user's profile, predictions (initial +
 *     match), scores, and login events.
 *   - NULLED in other rows (on delete set null): any other player's
 *     last_place_user_id that pointed at this user, and created_by on any
 *     fixtures/results this user created.
 *
 * Irreversible. Pick the target with --email=<addr>.
 *
 *   Local:  npm run wc2026:user:del -- --email=miqui@porra.com
 *   Prod:   npm run wc2026:user:del:prod -- --email=miqui@porra.com
 */
import { assertSafeTarget, detectTarget } from "../lib/env";
import { createScriptAdminClient } from "../lib/supabase";
import { done, fatal, info, step, warn } from "../lib/log";

function parseEmailArg(): string {
  const arg = process.argv.find((a) => a.startsWith("--email="));
  const email = arg?.slice("--email=".length).trim().toLowerCase();
  if (!email) fatal("Missing --email=<addr>. Example: -- --email=miqui@porra.com");
  return email;
}

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: true });

  const email = parseEmailArg();
  const supabase = createScriptAdminClient();

  step("Locating auth user");
  info("email", email);
  let userId: string | undefined;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) fatal("Failed listing auth users", error);
    const batch = data?.users ?? [];
    const match = batch.find((u) => u.email?.toLowerCase() === email);
    if (match) {
      userId = match.id;
      break;
    }
    if (batch.length < 100) break;
  }
  if (!userId) fatal(`No auth user found for ${email} on this Supabase project`);

  // Report the footprint that will be removed, for the record.
  const { count: predCount } = await supabase
    .from("match_predictions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const { count: lastPlaceRefs } = await supabase
    .from("initial_predictions")
    .select("id", { count: "exact", head: true })
    .eq("last_place_user_id", userId);
  info("match predictions to remove", String(predCount ?? "unknown"));
  info("other players' last_place pointing here (will be nulled)", String(lastPlaceRefs ?? "unknown"));

  step("Deleting auth user (cascades)");
  warn(`Permanently deleting ${email} (id ${userId})`);
  const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
  if (delErr) fatal(`Failed deleting auth user ${email}`, delErr);

  // Confirm the profile is gone.
  const { data: row } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (row) fatal(`Auth user deleted but profile row for ${email} still exists`);

  step("Done");
  done(`${email} deleted (profile + cascaded rows removed)`);
}

main().catch((err) => {
  fatal("delete-user failed", err);
});
