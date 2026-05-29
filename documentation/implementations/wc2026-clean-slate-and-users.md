# wc_2026 clean-slate & real users (production runbook)

> Context: [`context/web/auth-and-profiles.md`](../../context/web/auth-and-profiles.md) ·
> [`context/data/seeding-and-master-data.md`](../../context/data/seeding-and-master-data.md)

How to take the database (local or production) to a clean production starting state:
master data + the group-stage fixtures of Jornada 1/2/3 (no results), seeded with the 15 real
accounts from `data/users/users_passwords.json`, each forced to change its temporary password on
first login. One account (`lluis@porra.com`) is the `is_scam` prank.

## What each piece does

| Piece | Effect |
|-------|--------|
| Migration `20260529120000_password_change_and_scam.sql` | Adds `profiles.must_change_password` + `profiles.is_scam`; pins both (and `role`) in the self-update RLS policy |
| Migration `20260529130000_login_events.sql` | Adds `login_events` (login audit log; admin-read, service-role insert) |
| `scripts/wc2026/clean-slate.ts` (`npm run wc2026:clean`) | Deletes all predictions/scores/snapshots/results/goals/terms for `wc_2026`, deletes non-`group_md1/2/3` fixtures (knockout placeholders), deletes **all** auth users (cascades to profiles) |
| `scripts/wc2026/create-users.ts` (`npm run wc2026:users`) | Creates the 15 accounts (email confirmed, temp password), sets `must_change_password=true`, `is_scam` for the flagged user, `role='admin'` for `david@porra.com`. Idempotent (re-run updates password + flags) |

`:prod` variants forward `--confirm-prod`, required by `assertSafeTarget` before any non-local write.

## Local (verified)

```bash
npm run db:reset        # applies migrations (incl. the new one)
npm run types:gen       # regenerate database.types.ts
npm run wc2026:upload   # master data + all 104 fixtures
npm run wc2026:clean    # → 72 fixtures (J1-J3), 0 results, 0 users
npm run wc2026:users    # → 15 accounts
```

Spot checks (docker psql):

```sql
select count(*) from auth.users;                          -- 15
select display_name, role, must_change_password, is_scam  -- David admin; all t; lluis is_scam t
  from public.profiles order by role desc, display_name;
select r.code, count(*) from public.fixtures f            -- group_md1/2/3 = 24 each, nothing else
  join public.rounds r on f.round_id = r.id group by r.code;
select count(*) from public.match_results;                -- 0
```

## Production

The hosted DB already holds throwaway test data. Apply in this order:

1. **Schema migrations** (one-time):
   ```bash
   npm run db:push      # supabase db push --linked → applies 20260529120000_… and 20260529130000_login_events
   ```
2. **Create `.env.prod`, then clean + seed.** The `:prod` npm scripts read **`.env.prod`** (gitignored),
   so your local `.env.local` is never touched. Put the production values in `.env.prod`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://qbphxsijmqortxhxlrnr.supabase.co
   SUPABASE_SECRET_KEY=<prod secret key — Supabase dashboard → Project Settings → API>
   ```
   Then:
   ```bash
   # npm run wc2026:upload:prod   # only if prod is missing master data / fixtures (usually NOT needed)
   npm run wc2026:clean:prod      # DESTRUCTIVE: wipes current prod predictions/results/users
   npm run wc2026:users:prod      # creates the 15 real accounts (David = admin)
   ```
   Each script prints the target URL and `Local: false` and refuses without `--confirm-prod`.

> ⚠️ `wc2026:clean:prod` deletes **every** auth user in the project. Only run it on the dedicated
> porra project.

## Vercel / env vars

No **new** environment variables are required — the feature reuses the existing Supabase keys
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`). The
service-role `SUPABASE_SECRET_KEY` is already used by other server actions (`createAdminClient`), so
the `changePassword` flag-clear works in production with no config change. Just redeploy `master`
after the migration is pushed.

## Avatars (optional)

Avatars are resolved from `public/images/users/<DisplayName>.png` (e.g. `David.png`, `Lluis.png`).
Missing files fall back to an initials disc — not required for go-live.

## Post-deploy smoke (browser)

- Log in as a normal account (e.g. `albert@porra.com`) → forced to `/cambiar-password` from any page →
  set new password → lands on home; re-login no longer redirects; `/perfil` changes it again.
- Log in as `lluis@porra.com` → scam pop-ups, blocked form, "ACTUALIZAR AHORA" → virus warning; the
  password never changes.
- `/register` redirects to `/login`; logged-out home shows only "Iniciar sesión".
