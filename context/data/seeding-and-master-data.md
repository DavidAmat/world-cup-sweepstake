# Master Data & Seeding

Bootstrap tournament structure — teams, stages, rounds, fixtures, and active scoring rules — from versioned JSON into Supabase. The active tournament is **`wc_2026`** only.

## What it is

Master data is everything the app needs before users can predict:

| Entity | Source | Uploaded to |
|--------|--------|-------------|
| Tournament metadata | `data/seeds/wc_2026/tournament.json` | `tournaments` |
| 48 teams (12 groups A–L) | `data/seeds/wc_2026/teams.json` | `teams` |
| 104 fixtures | `data/seeds/wc_2026/fixtures.json` | `fixtures` |
| Stage/round catalog | `src/lib/fixtures/catalogs.ts` (hardcoded) | `stages`, `rounds` |
| Scoring rules v1 | `DEFAULT_SCORING_RULES_V1` in code | `scoring_rules` |
| 15 real accounts | `data/users/users_passwords.json` | `auth.users` + `profiles` |

**Supabase is runtime source of truth.** JSON under `data/seeds/` is the committed bootstrap snapshot. The admin edits fixtures through `/admin/fixtures` after seeding; there is no download/sync script for 2026.

`db:reset` applies migrations and auth seed only — it does **not** load tournament data. After every fresh reset run `npm run wc2026:upload`.

## Tournament shape (wc_2026)

- **48 teams** in **12 groups** (A–L), 4 per group, 2 qualifiers per group (`group_qualifiers_per_group: 2`)
- **72 group matches** — 3 jornadas × 24 matches (FIFA pairing template per group)
- **32 knockout placeholders** — R32 (16), R16 (8), QF (4), SF (2), third place (1), final (1); both sides `"TBD"` until admin assigns teams or imports real pairings
- **Total: 104 fixtures**
- **`is_test: true`** until the real porra starts (flip manually in DB when ready)

Group calendar (all kickoffs 18:00 Madrid local in seed JSON):

| Jornada | Date |
|---------|------|
| 1 | 2026-05-29 |
| 2 | 2026-06-03 |
| 3 | 2026-06-10 |

Knockout placeholder dates: R32 2026-06-20, R16 2026-06-24, QF 2026-06-28, SF 2026-06-30, third + final 2026-07-01.

## Data flow

```
data/seeds/wc_2026/{tournament,teams,fixtures}.json
        │
        ▼
scripts/wc2026/upload.ts  (tsx + service-role client)
        │
        ▼
Supabase: tournaments → stages → rounds → teams → fixtures
          + scoring_rules v1 (active)
```

**Regenerating fixtures:** edit the manifest in `scripts/wc2026/gen-fixtures.ts`, run `tsx scripts/wc2026/gen-fixtures.ts`, commit the updated `fixtures.json`, then re-upload.

**Adding/updating knockouts:** prefer `/admin/fixtures/import` (JSON paste) once real pairings are known — see `context/web/fixtures-admin.md`. Same `PythonMatchSchema` as the seed pipeline.

## Shared format (`PythonMatchSchema`)

One JSON match shape is shared by:

- Seed JSON (`fixtures.json`)
- Admin bulk import (`src/lib/fixtures/pythonFormat.ts`)
- TypeScript upload (`scripts/lib/schemas.ts` re-exports the schema)

Key fields: `external_id` (stable, snake_case), `fase`, `jornada`, `grupo`, `equipo_1`/`equipo_2`, `fecha` (Madrid local `YYYY-MM-DD HH:MM:SS`). Knockouts without teams use `"TBD"` on both sides.

Stage/round resolution (`fase` + `jornada` → DB codes) lives in `pythonFormat.ts`. Groups A–L; includes `dieciseisavos` → R32.

## Python tooling (optional, not runtime)

A separate **uv + pandas** project under `data/raw/` converts historical FIFA CSV datasets to JSON. It is **not** part of the Next.js app and **not** required for day-to-day dev — the committed `data/seeds/wc_2026/` files are the canonical bootstrap.

The 2026 fixture set was generated with `gen-fixtures.ts`, not the Python CSV pipeline. See `documentation/services/data-tooling/python-pipeline.md` for setup and current limitations.

## Local workflow

```bash
npm run db:reset          # schema + auth seed only
npm run wc2026:upload     # load wc_2026 master data
```

Requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2026` in `.env.local`.

Expected counts after upload:

```
tournaments: 1   stages: 7   rounds: 9   teams: 48   fixtures: 104
scoring_rules: 1 (v1, active)   match_results: 0   players: 0
```

Re-running upload is idempotent (upsert on slug / `(tournament_id, external_id)`).

## Production upload

Non-local URLs require `--confirm-prod`:

```bash
NEXT_PUBLIC_SUPABASE_URL=<prod-url> \
SUPABASE_SECRET_KEY=<secret> \
  npx tsx scripts/wc2026/upload.ts --confirm-prod
```

Scripts auto-rewrite `127.0.0.1` → LAN IP for tsx (same quirk as other Supabase CLI scripts). See `scripts/lib/env.ts`.

## Clean-slate & user creation (production start)

Two extra scripts take the DB to a production starting state (real accounts, only Jornada 1/2/3
fixtures, no results):

```bash
npm run wc2026:clean    # delete predictions/scores/results/terms; delete knockout fixtures; delete all users
npm run wc2026:users    # create the 15 accounts from data/users/users_passwords.json
```

- `clean-slate.ts` keeps master data + `group_md1/2/3` fixtures (deletes the 32 knockout placeholders)
  and deletes every auth user (cascades to profiles).
- `create-users.ts` creates each account with a temporary password and `must_change_password=true`,
  sets `is_scam` for the flagged user, and promotes `david@porra.com` to `admin`. Idempotent.
- `:prod` variants forward `--confirm-prod`. Full runbook:
  `documentation/implementations/wc2026-clean-slate-and-users.md`.

`users_passwords.json` is committed bootstrap (usernames + temporary passwords); since users are
forced to change their password on first login, it is only the initial handout.

## What is intentionally empty

- **`players`** — pichichi and mejor jugador are free text on `initial_predictions`, not player FKs
- **`match_results`** — admin enters results in `/admin/results` after seeding

## Retired: wc_2022

The Catar 2022 test tournament and its scripts/seeds were **removed from the repo**. See `documentation/deprecated/wc2022-seed-and-sync.md` for history only.

## Where to look deeper

- Upload script detail: `documentation/services/data-tooling/seed-scripts.md`
- Python CSV tooling: `documentation/services/data-tooling/python-pipeline.md`
- Admin fixture edits/import: `context/web/fixtures-admin.md`
- Stage catalog + scoring multipliers: `src/lib/fixtures/catalogs.ts`
- Local dev commands: `context/04-local-development.md`
