# World Cup Sweepstake — Complete Project Overview (draft)

> **Draft.** Produced during planning from a high-level scan. Phase 1 (task P1-2) finalizes
> this against code and moves it to `context/00-project-complete-overview.md`. Self-contained:
> paste this alone to orient a fresh LLM. Code-truth wins — verify numbers before publishing.

## What it is

A **private web app** to run a friends' World Cup 2026 sweepstake ("porra") for ~10 people in
Spain. It replaces a manual spreadsheet with automated, transparent, versioned scoring. UI is
in **Spanish**; code and database are in **English**. Live on Vercel, **not yet public**.

Each user predicts:
- **Per-match** results (90' score; for knockouts also prórroga / penaltis / who qualifies).
- **Tournament-wide initial predictions**: champion, runner-up, `pichichi` (top scorer, free
  text), `mejor jugador` (best player, free text).
- **Group qualification** (`clasificados`): which 2 teams advance per group.

An admin enters real results by hand; a scoring engine computes a leaderboard with full
per-prediction breakdowns.

## Stack

- **Next.js 16.2.6** App Router · **React 19.2.4** · **TypeScript 5** · **Tailwind v4**.
- **Supabase**: Auth (email/password) + **Postgres 17** + **RLS**, via `@supabase/ssr`.
  Three clients: browser (`client.ts`), server (`server.ts`), service-role (`admin.ts`).
- `react-hook-form` + `zod`; `date-fns`; `lucide-react`; `country-flag-icons`.
- **Vercel** hosting, auto-deploy from GitHub `master`.
- Separate **Python (uv, 3.12 + pandas)** tooling under `data/raw/` converts FIFA CSV → seed
  JSON; not part of the Next.js runtime.
- No automated test framework by choice — verification via smoke scripts + SQL/`psql`.

> **Next.js note:** the request interceptor is **`src/proxy.ts`** (Next.js 16 renamed
> `middleware.ts` → `proxy.ts`). Read `node_modules/next/dist/docs/` before using Next APIs.

## Domain flow

1. **Seed master data** (`scripts/wc2026/upload.ts`): 48 teams in 12 groups (A–L), fixtures,
   stages, rounds, and the active `scoring_rules` version. Every row carries a `tournament_id`
   (the data model is multi-tournament). The app runs on the real 2026 calendar; an early
   `wc_2022_test` tournament is **retired** and is not documented as current.
2. **Register / login** (Supabase Auth). A trigger `handle_new_user` creates a `profiles` row
   (`role` = `player` by default; admins promoted manually). Users accept rules/terms.
3. **Initial predictions** (`/predictions/initial`) and **group qualification** stay editable
   until the admin sets `tournaments.initial_predictions_locked_at`.
4. **Match predictions** (`/predictions/matches`) per `jornada`. A `jornada` locks when the
   admin sets `rounds.predictions_locked_at` (manual; the old 24h auto-lock is removed). While
   open, others' predictions are hidden by RLS; once locked, they become visible.
5. **Admin enters results** (`/admin/results`): 90' goals, prórroga/penaltis, qualified team,
   goleadores; status draft → confirmed. Knockout pairings can be generated per round.
6. **Scoring engine** (`src/lib/scoring/*`, orchestrated by `recalculateCore.ts`) reads
   predictions + results, applies the active `scoring_rules` JSON, and writes
   `prediction_scores` with a per-criterion breakdown. Idempotent / recalculable; rule changes
   recompute losslessly.
7. **Leaderboards** (`/clasificacion/*`: general, jornada, fase, categoria, partido,
   evolucion) and `/my-scores` show rankings, per-match breakdown popovers, and an evolution
   chart.

## Scoring (authoritative = active `scoring_rules` + `user_guides/puntuacion.md`)

- **Group match:** correct outcome **5**; exact score **10** (absorbs the two below);
  per-team goal distance **3/2/1** (exact/off-by-1/off-by-2); goal-difference **3**. ×1.
- **Knockout:** group-match points **plus** correct prórroga **5**, correct penaltis **5**,
  correct qualified team **8** — prórroga/penaltis only score if they actually happened.
- **Stage multipliers:** group ×1; r32/octavos/cuartos/tercer puesto ×2; semifinales ×3;
  final ×5.
- **Initial:** champion **200**, runner-up **150**, `pichichi` **100**, `mejor jugador`
  **100** (the last two judged by the admin in `/admin/evaluaciones`).
- **Group qualification:** **25** per correctly chosen team.

> Older legacy docs cite 10/8/3 — those are **stale**. Use the values above.

## Data model (high level)

~17 tables, all RLS-enabled, all keyed by `tournament_id`:
`tournaments`, `profiles`, `app_settings`, `teams`, `players`, `stages`, `rounds`,
`fixtures`, `match_results`, `match_goals`, `player_match_stats`, `initial_predictions`,
`group_qualification_predictions`, `match_predictions`, `scoring_rules`, `prediction_scores`,
`leaderboard_snapshots`, `terms_acceptances`. Status/role/type fields are CHECK constraints
(no Postgres enums). `prediction_scores.prediction_type` ∈ `group_phase | knockout | initial |
group_qualification`.

Key functions: `is_admin()` (RLS gate), `app_now()` (returns `app_settings.fecha_actual` or
real `now()`), `is_fixture_locked()` (reads `rounds.predictions_locked_at`),
`are_initial_predictions_locked()`, `handle_new_user()`, `set_updated_at()`.

## Infra: local vs prod (keep distinct)

- **Local:** `npm run db:start` (Docker Supabase), `db:reset` (migrations + seed), `types:gen`
  (regenerate `database.types.ts`), Studio `:54323` / API `:54321` / DB `:54322`. A known
  quirk rewrites `127.0.0.1` → a LAN IP for the CLI's Docker on macOS. `FECHA_ACTUAL` (via
  `make fecha`) simulates "now" by syncing `app_settings.fecha_actual`, which `app_now()` reads
  so RLS and app agree.
- **Prod:** hosted Supabase; migrations applied **manually** with `npm run db:push`
  (`supabase db push --linked`). Uses new `publishable`/`secret` keys.
- **Deploy:** PR → Vercel Preview; merge to `master` → production. DB migrations are not
  automated.

## Conventions

Server Actions (`actions.ts`) for mutations; Zod `schemas.ts` per feature; `requireAuth()` /
`requireAdmin()` guards; RLS enforced in DB. Spanish UI copy, English identifiers. Light mode
only (dark mode removed). Prettier + Tailwind plugin; ESLint (`eslint-config-next`).

## Status / history

Hitos 02–12 shipped (setup, supabase, schema, auth, seeds, fixtures, initial & match
predictions, results, scoring, WC2026 migration, leaderboards). 13 deleted. 14 (admin
reset + reglas) and 15 (palette / Plus Jakarta Sans / no dark mode) closed; 16 UI tweaks
(floating navbar, home dashboard) shipped. An **avatars/profiles** feature is in progress
(currently untracked; avatar names/images are test placeholders pending real usernames).
Catar 2022 / `wc_2022_test` was an early test and is now retired.
