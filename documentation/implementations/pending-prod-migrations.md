# Pending production migrations & deploy steps

Running tracker for changes applied **locally** that still need to be applied to
**production**. Work local-first, then apply this whole list to prod in order.

> Apply schema with `npm run db:push` (`supabase db push --linked`) — it pushes
> every migration not yet on the linked prod DB, in filename order.

## Schema migrations pending on prod

| # | Migration file | What it does | Local | Prod |
|---|----------------|--------------|:-----:|:----:|
| 1 | `supabase/migrations/20260529120000_password_change_and_scam.sql` | `profiles.must_change_password` + `profiles.is_scam`; pins both (and `role`) in the self-update RLS policy | ✅ | ✅ pushed 2026-05-29 |
| 2 | `supabase/migrations/20260529130000_login_events.sql` | `login_events` table (login audit log; admin-read, service-role insert) | ✅ | ✅ pushed 2026-05-29 |

Linked prod project ref: `qbphxsijmqortxhxlrnr`. Verified with `supabase migration list --linked` (both rows show LOCAL | REMOTE).

After `db:push`, regenerate types only matters locally (`npm run types:gen`); prod uses the deployed build.

## Data / script steps pending on prod (run after schema push)

These are **not** migrations. The `:prod` npm scripts read **`.env.prod`** (a
gitignored file you create with the production URL + secret key) and pass
`--confirm-prod`. This keeps `.env.local` (local) untouched. Create `.env.prod`:

```
NEXT_PUBLIC_SUPABASE_URL=https://qbphxsijmqortxhxlrnr.supabase.co
SUPABASE_SECRET_KEY=<prod secret/service_role key from Supabase dashboard → Project Settings → API>
```

| Step | Command | Notes | Done |
|------|---------|-------|:----:|
| Clean slate | `npm run wc2026:clean:prod` | DESTRUCTIVE: deletes all prod predictions/scores/results/terms + every auth user; keeps master data + J1–J3 fixtures | ✅ 2026-05-29 (removed 2 users, 32 knockout fixtures; 72 J1–J3 kept) |
| Create users | `npm run wc2026:users:prod` | 15 accounts from `data/users/users_passwords.json`; David = admin; forced password change | ✅ 2026-05-29 (15 users; David admin; Lluis scam; all must_change_password) |

Each script prints the target URL and `Local: false` before writing, and refuses
without `--confirm-prod`. Master data (`wc2026:upload:prod`) is **not** needed —
prod already has teams/fixtures. Full detail: `wc2026-clean-slate-and-users.md`.

## Features with NO migration (code-only — ship via deploy)

These shipped in this round and need **only a `master` deploy** (no DB change):

- **Forced password change + `/perfil` + scam prank** (uses migration #1).
- **Admin Users + login log** (uses migration #2).
- **Clasificados best-8-thirds** (`/predictions/initial` 2-or-3 per group rule, `computeAdvancingTeams` scoring, `/admin/standings`). **No migration** — `group_qualification_predictions` already stores 2–3 rows per group; only validation + scoring logic changed.

## Deploy order summary

1. ✅ `npm run db:push` — applied migrations #1, #2 to prod (2026-05-29).
2. ⬜ Merge/deploy `master` to Vercel (code for all features above) — **remaining**.
3. ✅ `npm run wc2026:clean:prod` + `npm run wc2026:users:prod` (via `.env.prod`) — done (2026-05-29).
4. No new Vercel env vars required.
