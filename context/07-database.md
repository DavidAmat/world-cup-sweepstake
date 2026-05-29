# Database Overview

Postgres 17 on Supabase. All domain data lives in schema `public`. Every table has RLS enabled. Multi-tournament design: domain tables carry `tournament_id`.

## Tables (18)

| Group | Tables |
|-------|--------|
| Core | `tournaments`, `profiles`, `terms_acceptances`, `app_settings` |
| Catalog | `teams`, `players`, `stages`, `rounds` |
| Fixtures & results | `fixtures`, `match_results`, `match_goals`, `player_match_stats` |
| Predictions | `initial_predictions`, `group_qualification_predictions`, `match_predictions` |
| Scoring | `scoring_rules`, `prediction_scores`, `leaderboard_snapshots` |

`player_match_stats` exists but hito 13 (stats UI) was deleted — table may hold data if entered, no public pages consume it.

## Key columns (locking)

| Table | Column | Purpose |
|-------|--------|---------|
| `tournaments` | `initial_predictions_locked_at` | Admin manual lock for initial + group qualification predictions |
| `rounds` | `predictions_locked_at`, `predictions_locked_by` | Admin manual lock per jornada |
| `app_settings` | `fecha_actual` | Simulated "now" for testing (`app_now()`) |

## Helper functions

| Function | Returns | Used by |
|----------|---------|---------|
| `is_admin()` | boolean | RLS policies; checks `profiles.role` |
| `app_now()` | timestamptz | RLS + app; reads `app_settings.fecha_actual` or `now()` |
| `is_fixture_locked(fixture_id)` | boolean | Match prediction RLS; true when round is manually locked |
| `are_initial_predictions_locked(tournament_id)` | boolean | Initial/GQP RLS; true when admin set lock column |
| `initial_predictions_lock_at(tournament_id)` | timestamptz | UI display only (legacy time cutoff helper) |
| `handle_new_user()` | trigger | Creates `profiles` row on auth signup |
| `set_updated_at()` | trigger | Auto-stamps `updated_at` on row update |

## RLS model (summary)

| Pattern | Tables |
|---------|--------|
| Select all authenticated; admin write | Catalog (`teams`, `players`, `stages`, `rounds`), fixtures/results, scoring derived tables |
| Own row + public when locked | `initial_predictions`, `group_qualification_predictions`, `match_predictions` |
| Own acceptances + admin | `terms_acceptances` |
| Own profile update (no role change) + admin | `profiles` |
| Admin-only write via app | `prediction_scores`, `leaderboard_snapshots` (recalc engine uses service role) |

Admin bypass: every table has a `*_admin_all` policy calling `is_admin()`. Service-role client bypasses RLS entirely.

## Derived data

`prediction_scores` and `leaderboard_snapshots` are **regenerated** by the scoring engine — not incrementally updated. On recalculation, rows for the tournament are deleted and reinserted.

`scoring_rules` is versioned; exactly one active row per tournament (partial unique index).

## Migrations

18 SQL files in `supabase/migrations/`, timestamp-prefixed, applied in lexicographic order. Local: `npm run db:reset`. Prod: `npm run db:push` (manual).

No Postgres enums — status/type fields use `text` + `CHECK` constraints.

Extensions: `pgcrypto`, `citext`.

Types: regenerate with `npm run types:gen` → `src/lib/supabase/database.types.ts`.

## Prediction type values

`prediction_scores.prediction_type` ∈ `group_phase | knockout | initial | group_qualification`.

## Where to look deeper

- Every column and FK: `documentation/services/database/tables.md`
- Every function body: `documentation/services/database/functions.md`
- Every policy: `documentation/services/database/rls.md`
- Migration workflow: `documentation/services/database/migrations.md`
