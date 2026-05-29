# Project Context — orientation primer for migration agents

> Read this file first. It is a ~150-line map so you don't have to rediscover the
> repo. Code-truth always wins: this primer is a starting point, verify against the
> actual code before you write.

## What the project is

A **private web app** to run a World Cup 2026 sweepstake ("porra") among ~10 friends in
Spain. Users register, make predictions (per-match scores and tournament-wide outcomes),
predictions lock per matchday, an admin enters real results by hand, and a scoring engine
computes a transparent, versioned leaderboard. UI is in **Spanish**; code and database are
in **English**. Deployed on Vercel (connected to GitHub `master`); data on Supabase.

The app is live on Vercel but **not yet disclosed to the public**.

## Where the code lives

```
src/app/                  Next.js App Router routes (route groups: (app), (auth), admin)
  (app)/predictions/      initial + matches prediction UIs (+ /public read-only views)
  (app)/clasificacion/    leaderboards: general, jornada, fase, categoria, partido, evolucion
  (app)/dashboard/        home dashboard
  (app)/my-scores/        personal score breakdown
  (auth)/login,register/  Supabase Auth pages
  admin/fixtures/         fixtures CRUD + JSON import
  admin/results/          results entry + per-round prediction lock + knockout pairings
  admin/evaluaciones/     subjective eval of pichichi / mejor jugador (free-text)
  admin/reglas/           scoring-rules versioning + recalculation
  admin/reset/            destructive data reset (confirm "BORRAR")
  rules/                  rules + terms acceptance
src/components/           layout/, scoring/, profiles/ (avatars), ui/ (shared primitives)
src/lib/                  supabase/ (client,server,admin,types), scoring/, predictions/ (locks),
                          permissions/ (requireAuth,requireAdmin), dates/ (appNow,madridTime),
                          fixtures/ (catalogs,pythonFormat), flags/, profiles/, tournament/
src/proxy.ts              Next.js 16 request proxy (this replaces the old middleware.ts — see below)
supabase/migrations/      versioned SQL (schema, RLS, functions); supabase/config.toml
scripts/                  wc2022/ wc2026/ seed+upload, scoring/smoke-recalc, recalc-tournament
data/                     raw/ (Python CSV→JSON pipeline), seeds/ (wc_2022, wc_2026), partidos/
```

## Tech stack (locked versions — confirm in lockfiles)

- **Next.js 16.2.6** (App Router) · **React 19.2.4** · **TypeScript 5** · **Tailwind v4**.
- **Supabase** (`@supabase/ssr` 0.10.x, `@supabase/supabase-js` 2.105.x) — Auth + Postgres
  (major_version 17) + RLS. Supabase CLI for local dev and migrations.
- `react-hook-form` + `zod` for forms/validation; `date-fns`; `lucide-react`;
  `country-flag-icons`.
- Tooling: ESLint 9 (`eslint-config-next`), Prettier 3 (+ tailwind plugin), `tsx` for scripts.
- A separate **Python (uv, 3.12)** data-tooling project under `data/raw/` + `pyproject.toml`
  converts FIFA CSV datasets to seed JSON. It is NOT part of the Next.js runtime.

## ⚠️ This is NOT the Next.js you know (read `node_modules/next/dist/docs/`)

`AGENTS.md` warns that this Next.js has breaking changes vs. older training data. The most
visible one in this repo: **`src/proxy.ts`** is the request interceptor — the file formerly
known as `middleware.ts`. Do not refer to it as "middleware.ts" and do not invent a
`middleware.ts`. Read the bundled docs before describing any Next.js API.

## Domain terminology — keep verbatim (do NOT translate)

`porra`, `pichichi` (top scorer), `mejor jugador` (best player), `predicción`, `empate`
(draw), `prórroga` (extra time), `penaltis` (penalty shootout), `fase de grupos` (group
stage), `clasificados` (qualified teams), `jornada`/`ronda` (matchday/round), `octavos`
(round of 16), `dieciseisavos` / `r32` (round of 32), `cuartos`, `semifinales`, `final`,
`tercer puesto`. Route names (`clasificacion`, `evaluaciones`, `reglas`), DB identifiers,
class names, and code symbols stay verbatim even when Spanish. Produced prose is English.

## Code-truth corrections (legacy docs are stale here — verify, don't copy)

- **Scoring values (authoritative = active `scoring_rules` + `documentation-old/user_guides/
  puntuacion.md`):** champion **200**, runner-up **150**, pichichi **100**, mejor jugador
  **100**; group match correct outcome **5**, exact score **10**, per-team goal distance
  3/2/1, goal-difference **3**; knockout prórroga **5**, penaltis **5**, correct qualified
  team **8**; group qualification **25 per correct team**. The PID/old plan values
  (10/8/3…) are **outdated** — do not use them.
- **Prediction locking is MANUAL per jornada** (admin sets `rounds.predictions_locked_at`),
  not the original 24h-before-kickoff auto-lock. The 24h rule is **removed**
  (migration `20260525120000`). See `documentation-old/user_guides/bloqueo_predicciones.md`.
- **`120'` goals were dropped** mid-build (migrations `..._drop_120`); columns may linger but
  are unused. Don't document them as active.
- **Dark mode was removed** (hito 15). **Hito 13** (results/stats pages) was **deleted**, never
  built. **Gemini/scraping** is plan-only, never in production (results are entered by hand).
- **Catar 2022 / `wc_2022_test` is retired.** It was only an early test; the project moved fully
  to the real 2026 calendar. **Do not document 2022 as current** — deprecate 2022 docs (banner),
  document the 2026 path only. (A separate, non-doc task will purge 2022 from the code; the doc
  agents must not touch code.)
- **Avatars/profiles** IS to be documented (full doc), even though untracked — the current
  avatar names/images are test placeholders that get swapped for real usernames later.
- Sub-agent summaries occasionally cite paths that do not exist (e.g. a `src/components/
  MatchesForm.tsx` or `PointsCell.tsx`). The real forms live under
  `src/app/(app)/predictions/matches/`. Always `ls`/grep before citing a path.

## Local vs. prod Supabase (make this distinction crisp in the docs)

- **Local:** `npm run db:start` (Docker), `npm run db:reset` (re-run migrations + seed),
  `npm run types:gen` (regenerate `src/lib/supabase/database.types.ts`), Studio on `:54323`,
  API on `:54321`, DB on `:54322`. A known quirk rewrites `127.0.0.1` → a LAN IP for the
  Supabase CLI Docker setup on macOS (hardcoded in `.env.local`; fragile under DHCP).
- **Prod:** hosted Supabase project; migrations applied **manually** with
  `npm run db:push` (`supabase db push --linked`) from local. New keys (`publishable` /
  `secret`) are used; legacy `anon`/`service_role` still valid through end of 2026.
- **`FECHA_ACTUAL` / `app_now()`:** a date-override for testing locks. `make fecha FECHA=…`
  rewrites `.env.local` and restarts dev; the app syncs `app_settings.fecha_actual`, which
  `app_now()` reads so RLS and app agree on "now".

## How it ships

PR to `master` → Vercel **Preview Deployment**. Merge to `master` → **production** deploy.
DB migrations are **not** automated — push them manually before/after deploy as needed.

## Conventions (confirm against eslint/prettier/code)

Server Actions for mutations (`actions.ts` per route), Zod `schemas.ts` per feature, three
Supabase clients (browser `client.ts`, server `server.ts`, service-role `admin.ts`),
`requireAuth()`/`requireAdmin()` guards, RLS enforced in DB (admin via `is_admin()`).
No automated tests by project choice — verification is smoke scripts + `psql`/SQL checks +
`npm run scoring:smoke`. Prettier + Tailwind plugin; Spanish UI copy, English identifiers.

## Milestone (hito) history — quick map

02 setup · 03 supabase local+migrations · 04 schema · 05 auth+profiles · 06 seeds/import ·
07 admin fixtures · 08 initial predictions · 09 match predictions · 10 results entry ·
11 scoring engine · 11b WC2026 + knockout sampling · 12 leaderboards+visuals (+ manual lock) ·
13 DELETED · 14 admin reset+reglas · 15 UI palette/Plus Jakarta/no dark mode · 16 UI tweaks
(floating navbar, home dashboard) · avatars/profiles (in progress, untracked).
