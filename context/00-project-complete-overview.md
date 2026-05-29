# World Cup Sweepstake — Complete Project Overview

Self-contained orientation doc. Paste this alone to onboard a fresh LLM. Code-truth wins — verify numbers against migrations and lockfiles before publishing.

## What it is

A **private web app** to run a friends' World Cup 2026 sweepstake ("porra") for ~10 people in Spain. It replaces a manual spreadsheet with automated, transparent, versioned scoring. UI is in **Spanish**; code and database are in **English**. Live on Vercel, **not yet public**.

Each user predicts:
- **Per-match** results (90' score; for knockouts also prórroga / penaltis / who qualifies).
- **Tournament-wide initial predictions**: champion, runner-up, `pichichi` (top scorer, free text), `mejor jugador` (best player, free text).
- **Group qualification** (`clasificados`): which 2 teams advance per group.

An admin enters real results by hand; a scoring engine computes a leaderboard with full per-prediction breakdowns.

## Stack

- **Next.js 16.2.6** App Router · **React 19.2.4** · **TypeScript 5** · **Tailwind v4**.
- **Supabase**: Auth (email/password) + **Postgres 17** + **RLS**, via `@supabase/ssr` 0.10.x / `@supabase/supabase-js` 2.105.x.
  Three clients: browser (`client.ts`), server (`server.ts`), service-role (`admin.ts`).
- `react-hook-form` + `zod`; `date-fns`; `lucide-react`; `country-flag-icons`.
- **Vercel** hosting, auto-deploy from GitHub `master`.
- Separate **Python (uv, 3.12 + pandas)** tooling under `data/raw/` converts FIFA CSV → seed JSON; not part of the Next.js runtime.
- No automated test framework by choice — verification via smoke scripts + SQL/`psql`.

> **Next.js note:** the request interceptor is **`src/proxy.ts`** (Next.js 16 renamed `middleware.ts` → `proxy.ts`). Read `node_modules/next/dist/docs/` before using Next APIs.

## Domain flow

1. **Seed master data** (`scripts/wc2026/upload.ts`): 48 teams in 12 groups (A–L), fixtures, stages, rounds, and the active `scoring_rules` version. Every row carries a `tournament_id` (multi-tournament data model). The app runs on the real 2026 calendar.
2. **Login** (Supabase Auth). Accounts are **pre-created** (public registration disabled) from `data/users/users_passwords.json` via `scripts/wc2026/create-users.ts`; `david@porra.com` is admin. Trigger `handle_new_user` creates the `profiles` row. Each account ships with a temporary password and `must_change_password=true`: the `proxy.ts` gate forces `/cambiar-password` on first login, and `/perfil` lets users change it later. One account (`is_scam`) gets a fake-malware prank page (`ScamExperience`). Users then accept rules/terms.
3. **Initial predictions** (`/predictions/initial`) and **group qualification** stay editable until the admin sets `tournaments.initial_predictions_locked_at`.
4. **Match predictions** (`/predictions/matches`) per `jornada`. A `jornada` locks when the admin sets `rounds.predictions_locked_at` (manual; the old 24h auto-lock is removed). While open, others' predictions are hidden by RLS; once locked, they become visible.
5. **Admin enters results** (`/admin/results`): 90' goals, prórroga/penaltis, qualified team, goleadores; status draft → confirmed. Knockout pairings can be generated per round.
6. **Scoring engine** (`src/lib/scoring/*`, orchestrated by `recalculateCore.ts`) reads predictions + results, applies the active `scoring_rules` JSON, and writes `prediction_scores` with a per-criterion breakdown. Idempotent / recalculable; rule changes recompute losslessly.
7. **Leaderboards** (`/clasificacion/*`: general, jornada, fase, categoria, partido, evolucion) and `/my-scores` show rankings, per-match breakdown popovers, and an evolution chart.

## Scoring (authoritative = active `scoring_rules` + `documentation/user_guides/puntuacion.md`)

- **Group match:** correct outcome **5**; exact score **10** (absorbs the two below); per-team goal distance **3/2/1** (exact/off-by-1/off-by-2); goal-difference **3**. ×1.
- **Knockout:** group-match points **plus** correct prórroga **5**, correct penaltis **5**, correct qualified team **8** — prórroga/penaltis only score if they actually happened.
- **Stage multipliers:** group ×1; r32/octavos/cuartos/tercer puesto ×2; semifinales ×3; final ×5.
- **Initial:** champion **200**, runner-up **150**, `pichichi` **100**, `mejor jugador` **100** (the last two judged by the admin in `/admin/evaluaciones`).
- **Group qualification:** **25** per correctly chosen team.

> Older legacy docs cite 10/8/3 — those are **stale**. Use the values above.

## Data model (high level)

19 tables, all RLS-enabled, all keyed by `tournament_id` where applicable:
`tournaments`, `profiles`, `app_settings`, `terms_acceptances`, `teams`, `players`, `stages`, `rounds`,
`fixtures`, `match_results`, `match_goals`, `player_match_stats`, `initial_predictions`,
`group_qualification_predictions`, `match_predictions`, `scoring_rules`, `prediction_scores`,
`leaderboard_snapshots`, `login_events` (admin-only login audit log). Status/role/type fields are CHECK constraints (no Postgres enums).
`profiles` carries `must_change_password` + `is_scam` flags (pinned in RLS).
`prediction_scores.prediction_type` ∈ `group_phase | knockout | initial | group_qualification`.

Key functions: `is_admin()` (RLS gate), `app_now()` (returns `app_settings.fecha_actual` or real `now()`), `is_fixture_locked()` (reads `rounds.predictions_locked_at`), `are_initial_predictions_locked()` (reads `tournaments.initial_predictions_locked_at`), `handle_new_user()`, `set_updated_at()`.

## Infra: local vs prod (keep distinct)

- **Local:** `npm run db:start` (Docker Supabase), `db:reset` (migrations + seed), `types:gen` (regenerate `database.types.ts`), Studio `:54323` / API `:54321` / DB `:54322`. A known quirk rewrites `127.0.0.1` → a LAN IP for the CLI's Docker on macOS.
- **Prod:** hosted Supabase; migrations applied **manually** with `npm run db:push` (`supabase db push --linked`). Uses new `publishable`/`secret` keys.
- **Deploy:** PR → Vercel Preview; merge to `master` → production. DB migrations are not automated.

## Conventions

Server Actions (`actions.ts`) for mutations; Zod `schemas.ts` per feature; `requireAuth()` / `requireAdmin()` guards; RLS enforced in DB. Spanish UI copy, English identifiers. Light mode only (dark mode removed). Prettier + Tailwind plugin; ESLint (`eslint-config-next`).

## Status / history

Hitos 02–12 shipped (setup, supabase, schema, auth, seeds, fixtures, initial & match predictions, results, scoring, WC2026 migration, leaderboards). 13 deleted. 14 (admin reset + reglas) and 15 (palette / Plus Jakarta Sans / no dark mode) closed; 16 UI tweaks (floating navbar, home dashboard) shipped. **Avatars/profiles** documented; avatar PNGs are test placeholders pending real usernames. **Production start:** registration disabled, 15 real accounts pre-created with forced first-login password change (`profiles.must_change_password`), `/perfil` self-service change, and a `profiles.is_scam` prank account; clean-slate + user-creation scripts under `scripts/wc2026/` — see `documentation/implementations/wc2026-clean-slate-and-users.md`.

## Documentation

- [`00-index.md`](00-index.md) — every file in `context/` and `documentation/`
- [`00-documentation-instructions.md`](00-documentation-instructions.md) — where to add or find topics
