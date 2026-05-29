# Local Development

How to run the app and Supabase locally. Distinct from production — see `context/06-vercel-supabase-infrastructure.md`.

## Prerequisites

- Node.js 20.9+
- Docker Desktop (for Supabase local)
- Supabase CLI (`brew install supabase`)
- Copy `.env.example` → `.env.local` and fill Supabase keys

## First-time setup

```bash
npm install
cp .env.example .env.local
npm run db:start          # starts local Supabase Docker stack
npm run db:reset          # apply all migrations + seed.sql
npm run types:gen         # regenerate src/lib/supabase/database.types.ts
npm run dev               # http://localhost:3000
```

After `db:start`, run `npm run db:status` to get local publishable/secret keys for `.env.local`.

## Daily dev loop

```bash
npm run db:start          # if Docker stack is stopped
npm run dev
npm run typecheck         # before committing
npm run lint
```

## Database commands

| Command | Effect |
|---------|--------|
| `npm run db:start` | Start local Supabase (Docker) |
| `npm run db:stop` | Stop local stack |
| `npm run db:status` | Show URLs, ports, keys |
| `npm run db:reset` | Drop and recreate DB; reapply all migrations + seed |
| `npm run db:diff` | Generate a new migration from schema drift |
| `npm run db:push` | Push migrations to **linked prod** project (manual, not local) |
| `npm run types:gen` | Regenerate TypeScript types from local DB |

Local ports (defaults): Studio `:54323`, API `:54321`, Postgres `:54322`.

## Type generation quirk

`types:gen` pipes CLI output through `grep -v '^Connecting to db'` because the Supabase CLI prints a status line to stdout that would break `tsc` if included in `database.types.ts`.

## Simulating "now" (`FECHA_ACTUAL`)

Prediction locking is **admin-controlled** from the UI (`/admin/results` for jornadas, initial lock on the tournament). There is no Makefile helper for date simulation.

The optional `FECHA_ACTUAL` env var syncs to `app_settings.fecha_actual` via `lib/dates/appNow.ts` so `app_now()` matches the app if you set it manually in `.env.local` and restart the dev server. It does **not** auto-lock predictions. See `context/shared/dates-and-timezone.md`.

## macOS Docker quirk

On macOS, the Supabase CLI Docker setup may require rewriting `127.0.0.1` → a LAN IP in `.env.local` (DHCP-sensitive). See `documentation/issues/local-dev/` (Phase 2).

## Seeding tournament data

After a fresh `db:reset`, upload WC 2026 master data:

```bash
npm run wc2026:upload
```

Requires `SUPABASE_SECRET_KEY` and tournament slug configured in `.env.local`.

## Promoting the first admin

Register a user, then in Supabase Studio (local `:54323` → Table Editor → `profiles`):

```sql
update public.profiles set role = 'admin' where user_id = '<uuid>';
```

## Config notes

- `[analytics] enabled = false` in `supabase/config.toml` — avoids a macOS Docker vector container failure.
- ESLint ignores `context/`, `supabase/`, `scripts/`, `data/` — markdown and SQL are not linted.

## Where to look deeper

- Prod vs local Supabase: `context/06-vercel-supabase-infrastructure.md`
- Migration policy: `documentation/services/database/migrations.md`
