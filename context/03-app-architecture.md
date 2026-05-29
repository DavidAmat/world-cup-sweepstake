# App Architecture

Single deployable: one Next.js app on Vercel talking to one Supabase Postgres project. No separate backend service.

## High-level diagram

```
Browser (React client components)
    │  supabase-js publishable key (RLS)
    ▼
Next.js 16 on Vercel
    │  Server Components + Server Actions
    │  lib/supabase/server.ts (session, RLS)
    │  lib/supabase/admin.ts (service role, server-only)
    ▼
Supabase Postgres 17
    Auth · RLS · SQL migrations · seed.sql
```

Request flow: `src/proxy.ts` refreshes the auth session on every request and gates `/admin/*` before render (redirects non-admins to `/`, unauthenticated to `/login`).

## Directory layout

```
src/
  app/                         Next.js App Router
    (app)/                     Authenticated player routes
      predictions/
        initial/               Tournament-wide predictions + public view
        matches/               Per-jornada match predictions + public view
      clasificacion/           Leaderboards (general, jornada, fase, categoria, partido, evolucion)
      my-scores/               Personal score breakdown
    (auth)/                    login, register
    admin/                     Admin-only (also gated in proxy.ts)
      fixtures/                CRUD + JSON import
      results/                 Result entry, round lock, knockout pairings
      evaluaciones/            Subjective pichichi / mejor jugador evaluation
      reglas/                  Scoring rules editor + recalculation trigger
      reset/                   Destructive tournament data reset
    rules/                     Terms and scoring rules acceptance
  components/
    layout/                    Header, Footer (floating navbar)
    scoring/                   Breakdown popovers, charts, points bars
    profiles/                  Avatar component
    ui/                        Shared primitives (Badge, SortableTable, NumberInput, …)
  lib/
    supabase/                  client.ts, server.ts, admin.ts, database.types.ts
    auth/                      signUp/signIn/signOut actions, error translation
    permissions/               requireAuth(), requireAdmin()
    predictions/               initialLock.ts, matchLock.ts
    scoring/                   Engine: recalculateCore, scoreMatch, scoreInitial, rules, leaderboard
    dates/                     appNow.ts (syncs FECHA_ACTUAL → app_settings), madridTime.ts
    fixtures/                  catalogs.ts, pythonFormat.ts
    profiles/                  avatars.ts
    tournament/                getDefaultTournament.ts
    flags/                     countryFlagMap.ts
  proxy.ts                     Session refresh + /admin gate (NOT middleware.ts)
supabase/
  migrations/                  Versioned SQL (18 migration files)
  config.toml                  Local Supabase CLI config
  seed.sql                     Post-migration seed hook
scripts/
  lib/                         shared upload helpers (env, upserts, schemas)
  wc2026/                      upload tournament seed data
  scoring/                     smoke-recalc.ts, recalc-tournament.ts
data/
  raw/                         Python CSV pipeline (uv project)
  seeds/wc_2026/               JSON master data for upload script
```

## Route groups

| Group | Path prefix | Auth |
|-------|-------------|------|
| Public | `/`, `/login`, `/register` | None |
| App | `/`, `/predictions/*`, `/clasificacion/*`, `/my-scores`, `/rules` | Authenticated (`requireAuth` in pages/actions) |
| Admin | `/admin/*` | Admin (`proxy.ts` gate + `requireAdmin` in actions) |

Public read-only prediction views exist at `/predictions/initial/public` and `/predictions/matches/public` (visible after lock).

## Supabase client usage

| Client | File | Key | RLS |
|--------|------|-----|-----|
| Browser | `lib/supabase/client.ts` | publishable | Yes |
| Server | `lib/supabase/server.ts` | publishable + cookies | Yes |
| Admin | `lib/supabase/admin.ts` | secret (`server-only`) | Bypass |

Admin client is used for: scoring recalculation, seed upload, reset, syncing `app_settings.fecha_actual` from env.

## Feature module pattern

Each feature area typically has:
- Page(s) under `app/`
- `actions.ts` — Server Actions (mutations)
- `schemas.ts` — Zod validation
- Business logic in `lib/<area>/`

## Scripts (outside Next runtime)

Run via `tsx --env-file=.env.local`:
- `npm run wc2026:upload` — seed tournament data to Supabase
- `npm run scoring:smoke` — verify recalculation pipeline

## Where to look deeper

- Routing detail: `documentation/services/web/routing.md` (Phase 2)
- Per-feature docs: `context/web/` overviews + `documentation/services/web/` detail files
- Database: `context/07-database.md`, `documentation/services/database/`
