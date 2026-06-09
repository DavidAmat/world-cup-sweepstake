/**
 * Create a SINGLE porra account from data/users/users_passwords.json — without
 * touching any of the other accounts.
 *
 * Use when adding one new player after onboarding, when the bulk create-users
 * script would be unsafe (it re-stamps passwords + must_change_password on every
 * account in the file, disrupting players who already chose their own password).
 *
 * CREATE-ONLY: if the target email already exists in Supabase Auth the script
 * ABORTS instead of updating it, so it can never overwrite an existing user.
 *
 * Mirrors create-users.ts for the one account: creates the auth user (email
 * confirmed), then stamps the profile created by the handle_new_user trigger
 * with role=player, must_change_password=true, is_scam=false.
 *
 * Pick the target with --email=<addr> (matched against the JSON file).
 *
 *   Local:  npm run wc2026:user:add -- --email=marciablanca@porra.com
 *   Prod:   npm run wc2026:user:add:prod -- --email=marciablanca@porra.com
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { assertSafeTarget, detectTarget } from "../lib/env";
import { createScriptAdminClient } from "../lib/supabase";
import { done, fatal, info, step } from "../lib/log";

const ADMIN_EMAIL = "david@porra.com";
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
    fatal("Missing --email=<addr>. Example: -- --email=marciablanca@porra.com");
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

  const isScam = entry.scam === true;
  const role = wantedEmail === ADMIN_EMAIL ? "admin" : "player";

  const supabase = createScriptAdminClient();

  step("Checking the email is free");
  info("email", wantedEmail);
  // Paginate the auth user list and refuse if the target already exists.
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) fatal("Failed listing auth users", error);
    const batch = data?.users ?? [];
    const clash = batch.find((u) => u.email?.toLowerCase() === wantedEmail);
    if (clash) {
      fatal(
        `Refusing to continue: ${wantedEmail} already exists (id ${clash.id}).\n` +
          "  This script is create-only and never overwrites existing accounts.",
      );
    }
    if (batch.length < 100) break;
  }

  step("Creating auth user");
  const { data, error } = await supabase.auth.admin.createUser({
    email: entry.email,
    password: entry.password,
    email_confirm: true,
    user_metadata: { display_name: entry.username },
  });
  if (error || !data?.user) fatal(`Failed creating auth user ${wantedEmail}`, error);
  const userId = data.user.id;

  step("Stamping profile flags");
  const { error: pErr } = await supabase
    .from("profiles")
    .update({
      display_name: entry.username,
      role,
      must_change_password: true,
      is_scam: isScam,
    })
    .eq("user_id", userId);
  if (pErr) fatal(`Failed updating profile for ${wantedEmail}`, pErr);

  step("Done");
  done(`${entry.username} <${wantedEmail}>  role=${role}${isScam ? "  scam=true" : ""}`);
  info("must_change_password", "true (player will be prompted on first login)");
  info("avatar", `optional: drop PNG at public/images/users/${entry.username}.png`);
}

main().catch((err) => {
  fatal("create-single-user failed", err);
});
