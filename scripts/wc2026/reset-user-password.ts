/**
 * Reset a SINGLE porra account's password back to the value in
 * data/users/users_passwords.json — without touching the other accounts.
 *
 * Use when one player reports their onboarding password no longer works.
 * It updates only the auth password (+ re-confirms the email) and re-arms
 * the change-password gate (must_change_password = true) so the player can
 * log in with the file password and then choose their own.
 *
 * It does NOT change role or is_scam.
 *
 * Pick the target with --email=<addr> (matched against the JSON file).
 *
 *   Local:  npm run wc2026:reset-pw -- --email=cesc@porra.com
 *   Prod:   npm run wc2026:reset-pw:prod -- --email=cesc@porra.com
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { assertSafeTarget, detectTarget } from "../lib/env";
import { createScriptAdminClient } from "../lib/supabase";
import { done, fatal, info, step } from "../lib/log";

const USERS_JSON = resolve(process.cwd(), "data/users/users_passwords.json");

const UsersSchema = z.array(
  z.object({
    username: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    scam: z.boolean().optional(),
  }),
);

function parseEmailArg(): string {
  const arg = process.argv.find((a) => a.startsWith("--email="));
  const email = arg?.slice("--email=".length).trim().toLowerCase();
  if (!email) {
    fatal("Missing --email=<addr>. Example: -- --email=cesc@porra.com");
  }
  return email;
}

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: true });

  const wantedEmail = parseEmailArg();
  const users = UsersSchema.parse(JSON.parse(readFileSync(USERS_JSON, "utf8")));
  const entry = users.find((u) => u.email.toLowerCase() === wantedEmail);
  if (!entry) fatal(`No entry for ${wantedEmail} in ${USERS_JSON}`);

  const supabase = createScriptAdminClient();

  step("Locating auth user");
  info("email", wantedEmail);

  // Find the auth user id by email (paginate to be safe).
  let userId: string | undefined;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) fatal("Failed listing auth users", error);
    const batch = data?.users ?? [];
    const match = batch.find((u) => u.email?.toLowerCase() === wantedEmail);
    if (match) {
      userId = match.id;
      break;
    }
    if (batch.length < 100) break;
  }
  if (!userId) fatal(`No auth user found for ${wantedEmail} on this Supabase project`);

  step("Resetting password");
  const { error: authErr } = await supabase.auth.admin.updateUserById(userId, {
    password: entry.password,
    email_confirm: true,
  });
  if (authErr) fatal(`Failed updating auth user ${wantedEmail}`, authErr);

  // Re-arm the change-password gate so the player sets their own next login.
  const { error: pErr } = await supabase
    .from("profiles")
    .update({ must_change_password: true })
    .eq("user_id", userId);
  if (pErr) fatal(`Failed updating profile for ${wantedEmail}`, pErr);

  step("Done");
  done(`${entry.username} <${wantedEmail}> password reset to the file value`);
  info("must_change_password", "true (player will be prompted on next login)");
}

main().catch((err) => {
  fatal("reset-user-password failed", err);
});
