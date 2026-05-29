# Vercel and Supabase Infrastructure

Hosting model for the single Next.js app and its Postgres backend. The **local vs prod Supabase distinction** is critical — they are separate instances with the same migration files.

## Architecture

```
GitHub (master)
    │
    ▼
Vercel ──► Next.js 16 app (Serverless Functions / Edge where configured)
    │         env: NEXT_PUBLIC_SUPABASE_* , SUPABASE_SECRET_KEY
    │
    ▼
Supabase (hosted, EU) ──► Postgres 17 + Auth + RLS
```

No AWS, no separate API server, no Redis. All persistence is Supabase Postgres.

## Two Supabase instances

| | **Local** | **Production (hosted)** |
|---|-----------|-------------------------|
| **Runs in** | Docker via Supabase CLI | Supabase cloud (free tier) |
| **Start** | `npm run db:start` | Always on (hosted) |
| **Reset** | `npm run db:reset` | Never reset casually; use admin reset UI for test data |
| **Migrations** | Applied automatically on `db:reset` | Applied manually: `npm run db:push` |
| **Keys** | From `npm run db:status` | From Supabase Dashboard → Project Settings → API |
| **Studio** | `http://localhost:54323` | Supabase Dashboard |
| **Linked** | Implicit (CLI project_id in config.toml) | `supabase link --project-ref <ref>` |

Local and prod share the **same migration files** in `supabase/migrations/` but maintain **independent data**.

## Environment variables

| Variable | Where used | Notes |
|----------|------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Project API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | RLS-enforced; replaces legacy `anon` key |
| `SUPABASE_SECRET_KEY` | Server only (`admin.ts`, scripts) | Bypasses RLS; never expose to client |
| `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG` | App UI default | Slug of active tournament row (`wc_2026`) |

Legacy `anon` / `service_role` keys still work through end of 2026 but this project uses publishable/secret naming.

`.env.local` is gitignored. Vercel stores the same vars for Preview + Production environments.

## Vercel environments

| Environment | Trigger | Supabase target |
|-------------|---------|-----------------|
| Preview | PR opened/updated | Hosted prod project (shared) |
| Production | Merge to `master` | Hosted prod project |

There is no separate staging Supabase project on the free tier.

## Auth infrastructure

- Supabase Auth handles registration, login, JWT sessions.
- `src/proxy.ts` refreshes tokens via `getClaims()` on each request.
- `/admin/*` is gated in the proxy before Server Components render.

## What is not automated

- DB migration push to prod (manual `db:push`)
- Seed upload to prod (`npm run wc2026:upload` against prod credentials)
- Admin promotion (manual SQL in Studio)

## Where to look deeper

- Local setup: `context/04-local-development.md`
- Deploy workflow: `context/05-deployment.md`
- Security posture: `context/08-security.md`
- Local Docker quirk: `documentation/issues/local-dev/` (Phase 2)
