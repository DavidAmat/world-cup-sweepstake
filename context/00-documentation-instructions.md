# Documentation Instructions

How this repository organizes documentation. Read this before writing or moving any doc.

## Two folders

| Folder | Audience | Content |
|--------|----------|---------|
| `context/` | LLM + human orientation | Short, dense, "what it is and how it flows" (≤ ~200 lines per entity file) |
| `documentation/` | Engineers | Exhaustive code detail: routes, columns, commands, runbooks |

**Rule of thumb:** what is it / how it flows → `context/`. File paths, endpoints, columns, exact commands → `documentation/`.

## Where does this go?

| I just… | Put it in |
|---------|-----------|
| Built a new feature / entity | `context/<area>/<entity>.md` (overview) **+** `documentation/services/<module>/<entity>.md` (detail), cross-linked both ways |
| Vibe-coded a feature and want the prompt/plan/iteration trail | `context/implementations/YYYY-MM-DD/<slug>/` |
| Wrote a stable how-to (time simulation, JSON import, recalculation…) | `documentation/implementations/<topic>.md` |
| Fixed a bug / hit an incident / wrote a troubleshooting runbook | `documentation/issues/<area>/` |
| Changed stack, deploy flow, infra, schema, security, or conventions | the matching `context/0X-*.md` platform file |
| Found docs that are wrong-but-historical / never-built | `documentation/archive/` (no banner) |
| Found docs for a feature we built then removed | `documentation/deprecated/` (banner required) |

## Repo areas (where entity docs live)

| Area | `context/` | `documentation/` |
|------|------------|-------------------|
| Platform (stack, deploy, DB overview, security, conventions) | `context/00–09` | `documentation/services/database/*` for schema detail |
| Web features (auth, predictions, scoring, leaderboards, admin…) | `context/web/` | `documentation/services/web/<area>.md` (one file per area) |
| Master data & seeding | `context/data/` | `documentation/services/data-tooling/` |
| Cross-cutting (Supabase clients, dates, locking) | `context/shared/` | linked from web + database docs |
| User-facing Spanish guides | — | `documentation/user_guides/` (Spanish, code-aligned) |

Do **not** document retired Catar 2022 / `wc_2022_test` paths. The 2026 path is authoritative.

## Cross-linking

- Every `context/<area>/<entity>.md` ends with **Where to look deeper** → its `documentation/...` detail and sibling entities.
- Every `documentation/` detail file opens with `> Context:` linking back to the overview.

## Size and platform context

- Keep `context/<area>/<entity>.md` ≤ ~200 lines; overflow goes to `documentation/`.
- Do **not** repeat platform context (`00–09`) inside entity files — link instead.
- UI/styling rules live in `context/web/ui-and-design.md`; `09-coding-conventions.md` links there, does not duplicate.

## After writing

1. Add new file(s) to `context/00-index.md` (one line each).
2. Update `context/00-project-complete-overview.md` for anything platform-level.
3. Append consumed legacy sources to `docs-migration/deletions-log.md`.

## Prime directive

Documentation work **never changes application code**, SQL, configs, scripts, or `.env*` values. Read code to verify claims; if code looks wrong, raise an open question — do not patch code here.

## Language

Produced docs are in **English**. Keep domain nouns and code identifiers verbatim (`pichichi`, `mejor jugador`, `prórroga`, `jornada`, route/table/function names). `documentation/user_guides/*.md` stay in **Spanish**.
