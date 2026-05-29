# Deployment

How code moves from local to Vercel. Database migrations are a separate manual step.

## Git workflow

| Branch | Purpose |
|--------|---------|
| `master` | Production (auto-deploys to Vercel) |
| `feat/<name>` | Feature work (one PR per hito or logical unit) |
| `fix/<name>` | Bug fixes |
| `chore/<name>` | Tooling, deps, docs |

## Vercel deploy flow

1. Open a PR against `master` → Vercel creates a **Preview Deployment** (unique URL per PR).
2. Merge to `master` → Vercel deploys to **production**.

Both preview and production read env vars configured in the Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG`

Preview and production currently share the **same hosted Supabase project** (free tier allows one project). Exercise caution when applying migrations or running destructive admin actions against prod.

## Build

Vercel runs `next build` on deploy. Local verification:

```bash
npm run build
npm run start
```

## Database migrations (manual)

Migrations are **not** automated in CI. Apply to production from a developer machine:

```bash
supabase login
supabase link --project-ref <project-ref>
npm run db:push    # supabase db push --linked
```

Workflow:
1. Write and test migration locally (`npm run db:reset`).
2. Regenerate types (`npm run types:gen`).
3. Merge app code that depends on the migration.
4. Run `db:push` against the linked prod project before or after deploy (coordinate with schema-dependent code).

See `documentation/issues/deployment/` (Phase 2) for a prod push runbook.

## Pre-deploy checks

```bash
npm run typecheck
npm run lint
npm run build
npm run scoring:smoke   # if scoring code changed
```

## Proxy behavior without env vars

`src/proxy.ts` skips session refresh when Supabase env vars are missing, so early Vercel deploys before env configuration do not crash.

## Where to look deeper

- Vercel + Supabase hosting model: `context/06-vercel-supabase-infrastructure.md`
- Migration naming and ordering: `documentation/services/database/migrations.md`
- Security / env layout: `context/08-security.md`
