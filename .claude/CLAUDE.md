@AGENTS.md

# World Cup Sweepstake — Claude Code entry point

This repo splits documentation into two trees. Use them before guessing from code alone.

| Folder | Use when you need… |
|--------|-------------------|
| [`context/`](../context/) | Short orientation: what it is, how it flows (≤ ~200 lines per entity) |
| [`documentation/`](../documentation/) | Exhaustive detail: routes, server actions, SQL, exact commands |

## Start here

1. [`context/00-project-complete-overview.md`](../context/00-project-complete-overview.md) — whole-project picture (paste to onboard)
2. [`context/00-index.md`](../context/00-index.md) — every doc file, one line each
3. [`context/00-documentation-instructions.md`](../context/00-documentation-instructions.md) — where to put or find a topic

**Code-truth wins.** Legacy plans and archived journals may be stale (scoring values, manual jornada lock, no dark mode, 2026-only path). Read implementing code under `src/`, `supabase/migrations/`, and `scripts/` to verify.

## Deep-dive by area (context overviews)

| Topic | Overview |
|-------|----------|
| Platform (stack, deploy, DB, security) | `context/01-project.md` … `context/09-coding-conventions.md` |
| Auth & profiles | [`context/web/auth-and-profiles.md`](../context/web/auth-and-profiles.md) |
| Initial predictions | [`context/web/initial-predictions.md`](../context/web/initial-predictions.md) |
| Match predictions | [`context/web/match-predictions.md`](../context/web/match-predictions.md) |
| Results entry | [`context/web/results-entry.md`](../context/web/results-entry.md) |
| Scoring engine | [`context/web/scoring-engine.md`](../context/web/scoring-engine.md) |
| Leaderboards | [`context/web/leaderboards.md`](../context/web/leaderboards.md) |
| Fixtures admin | [`context/web/fixtures-admin.md`](../context/web/fixtures-admin.md) |
| Admin reset & rules | [`context/web/admin-reset-and-rules.md`](../context/web/admin-reset-and-rules.md) |
| UI & design | [`context/web/ui-and-design.md`](../context/web/ui-and-design.md) |
| Avatars | [`context/web/avatars-profiles.md`](../context/web/avatars-profiles.md) |
| Seeding (2026) | [`context/data/seeding-and-master-data.md`](../context/data/seeding-and-master-data.md) |
| Supabase clients / dates / locking | [`context/shared/`](../context/shared/) |

Each overview ends with **Where to look deeper** → matching file under `documentation/services/web/` (or `database/`, `data-tooling/`).

## Spanish player guides

[`documentation/user_guides/`](../documentation/user_guides/) — `puntuacion.md`, `bloqueo_predicciones.md` (authoritative for players; code-aligned).

## Next.js in this repo

The request interceptor is **`src/proxy.ts`** (not `middleware.ts`). Read `node_modules/next/dist/docs/` before changing Next APIs.
