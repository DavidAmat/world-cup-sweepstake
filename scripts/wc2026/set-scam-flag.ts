/**
 * Set ONLY the profiles.is_scam flag for a single account, by email.
 *
 * Touches nothing else — no password, no role, no must_change_password — so it
 * is safe to run against players who have already chosen their own password.
 *
 * Pick the target with --email=<addr> and the value with --scam=true|false.
 *
 *   Local:  npm run wc2026:set-scam -- --email=lluis@porra.com --scam=false
 *   Prod:   npm run wc2026:set-scam:prod -- --email=lluis@porra.com --scam=false
 */
import { assertSafeTarget, detectTarget } from "../lib/env";
import { createScriptAdminClient } from "../lib/supabase";
import { done, fatal, info, step } from "../lib/log";

function parseArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg?.slice(`--${name}=`.length).trim();
}

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: true });

  const email = parseArg("email")?.toLowerCase();
  if (!email) fatal("Missing --email=<addr>. Example: -- --email=lluis@porra.com");

  const scamRaw = parseArg("scam");
  if (scamRaw !== "true" && scamRaw !== "false") {
    fatal("Missing/invalid --scam=true|false. Example: -- --scam=false");
  }
  const isScam = scamRaw === "true";

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

  step("Updating is_scam");
  info("is_scam", String(isScam));
  const { error: pErr } = await supabase
    .from("profiles")
    .update({ is_scam: isScam })
    .eq("user_id", userId);
  if (pErr) fatal(`Failed updating profile for ${email}`, pErr);

  // Read it back to confirm.
  const { data: row, error: rErr } = await supabase
    .from("profiles")
    .select("display_name, is_scam")
    .eq("user_id", userId)
    .single();
  if (rErr) fatal(`Failed reading back profile for ${email}`, rErr);

  step("Done");
  done(`${row.display_name} <${email}>  is_scam=${row.is_scam}`);
}

main().catch((err) => {
  fatal("set-scam-flag failed", err);
});
