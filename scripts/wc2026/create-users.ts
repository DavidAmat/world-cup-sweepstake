/**
 * Create the real porra accounts from data/users/users_passwords.json.
 *
 * Each account is created in Supabase Auth with email confirmed and a
 * temporary password. The handle_new_user trigger creates the profiles row;
 * we then stamp the administrative flags via the service-role client:
 *   - must_change_password = true  (forces the change-password gate on login)
 *   - is_scam              = entry.scam === true
 *   - role                 = 'admin' for ADMIN_EMAIL, else 'player'
 *
 * Idempotent: if an email already exists we update its password + flags
 * instead of failing, so the script is safe to re-run.
 *
 *   Local:  npm run wc2026:users
 *   Prod:   npm run wc2026:users:prod   (forwards --confirm-prod)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { assertSafeTarget, detectTarget } from "../lib/env";
import { createScriptAdminClient } from "../lib/supabase";
import { done, fatal, info, step, warn } from "../lib/log";

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

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: true });

  const users = UsersSchema.parse(JSON.parse(readFileSync(USERS_JSON, "utf8")));
  info("users to create", users.length);

  const supabase = createScriptAdminClient();

  // Build an email → existing user id map once (handles re-runs).
  const existing = new Map<string, string>();
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) fatal("Failed listing auth users", error);
    const page = data?.users ?? [];
    for (const u of page) if (u.email) existing.set(u.email.toLowerCase(), u.id);
    // listUsers page 1 returns up to perPage; if fewer than perPage, we're done.
    if (page.length < 100) break;
  }

  step("Creating / updating accounts");
  for (const u of users) {
    const email = u.email.toLowerCase();
    const isScam = u.scam === true;
    const role = email === ADMIN_EMAIL ? "admin" : "player";

    let userId = existing.get(email);
    if (userId) {
      warn(`exists, updating: ${email}`);
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: u.password,
        email_confirm: true,
        user_metadata: { display_name: u.username },
      });
      if (error) fatal(`Failed updating auth user ${email}`, error);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { display_name: u.username },
      });
      if (error || !data?.user) fatal(`Failed creating auth user ${email}`, error);
      userId = data.user.id;
    }

    // Stamp flags + role on the profile (created by the handle_new_user trigger).
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        display_name: u.username,
        role,
        must_change_password: true,
        is_scam: isScam,
      })
      .eq("user_id", userId);
    if (pErr) fatal(`Failed updating profile for ${email}`, pErr);

    done(`${u.username} <${email}>  role=${role}${isScam ? "  scam=true" : ""}`);
  }

  step("Done");
  info("accounts", users.length);
  info("admin", ADMIN_EMAIL);
  info("avatars", "optional: drop PNGs at public/images/users/<DisplayName>.png (e.g. David.png)");
}

main().catch((err) => {
  fatal("create-users failed", err);
});
