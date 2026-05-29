# Project and Domain

## What it is

A private web app ("porra") for ~10 friends in Spain to run a World Cup 2026 sweepstake. Users register, submit predictions, and compete on a transparent leaderboard. An admin enters real match results and controls when predictions lock.

The app replaces a manual Excel workflow where predictions were sent privately, compiled by hand, and scored with inflexible rules.

## Who uses it

| Role | Capabilities |
|------|--------------|
| **Player** | Register, accept terms, submit/edit predictions (while unlocked), view leaderboards and own scores |
| **Admin** | Everything a player can do, plus: enter results, lock predictions, manage fixtures, edit scoring rules, recalculate, reset test data, evaluate subjective predictions (`pichichi` / `mejor jugador`) |

Admins are promoted manually in the database (`profiles.role = 'admin'`). There is no self-service admin signup.

## What users predict

### Initial predictions (tournament-wide)

One submission per user per tournament:
- Champion and runner-up (team picks)
- `pichichi` — top scorer (free text)
- `mejor jugador` — best player (free text)
- **Group qualification** (`clasificados`) — which 2 teams advance from each group

Locked when the admin sets `tournaments.initial_predictions_locked_at`. Once locked, all users' initial predictions become visible.

### Match predictions (per fixture)

For each fixture in an open `jornada`:
- 90' score (home / away goals)
- Knockout extras: prórroga score, penaltis, predicted qualified team

Locked per `jornada` when the admin sets `rounds.predictions_locked_at`. While open, RLS hides other users' predictions; after lock they become public.

## How scoring works (summary)

A versioned `scoring_rules` JSON drives point values. The engine recalculates from scratch on each confirmed result or rule change. See `context/web/scoring-engine.md` (Phase 2) and `documentation/user_guides/puntuacion.md` for full values.

Current authoritative values:
- Group match: outcome 5, exact score 10, per-team goal distance 3/2/1, goal difference 3
- Knockout extras: prórroga 5, penaltis 5, qualified team 8 (only if they occurred)
- Stage multipliers: group ×1; r32/octavos/cuartos/tercer puesto ×2; semifinales ×3; final ×5
- Initial: champion 200, runner-up 150, pichichi 100, mejor jugador 100 (subjective — admin marks correct in `/admin/evaluaciones`)
- Group qualification: 25 per correct team

> Legacy PID/plan docs cite 10/8/3 and a 24h auto-lock — both are **stale**.

## Domain principles

- **Simplicity** over complex architecture; ~10 users, free tiers only.
- **Supabase as source of truth** — JSON seeds bootstrap data; runtime state lives in Postgres.
- **Manual results entry** — no scraping or external APIs in the product path.
- **Recalculable scores** — rule changes and result corrections trigger full recomputation.
- **Multi-tournament schema** — single DB, `tournament_id` on domain tables; the app targets WC 2026.
- **Spanish UI, English code** — labels and copy in Spanish; identifiers, tables, and code in English.

## What is explicitly out of scope

- Public/commercial deployment (private friends group)
- Automated result ingestion (Gemini/scraping was plan-only, never shipped)
- Player-level match statistics pages (hito 13 deleted)
- Dark mode (removed in hito 15)
- Email confirmation or OAuth (email/password only; password reset via admin in Studio)
- Automated test suite (smoke scripts + manual SQL checks instead)

## Where to look deeper

- Scoring detail: `documentation/user_guides/puntuacion.md`, `context/web/scoring-engine.md`
- Prediction locking: `context/shared/prediction-locking.md`
- Auth and profiles: `context/web/auth-and-profiles.md`
- Database overview: `context/07-database.md`
