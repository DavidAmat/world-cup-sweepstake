# Docs Migration Checklist — World Cup Sweepstake

Status: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked.
Staging mode: **Appendix A** — sources live in `context-old/` and `documentation-old/`.
Each task: read `project-context.md` first, code-truth wins, append to `deletions-log.md`,
update `context/00-index.md`, flip the checkbox. Tasks ordered by dependency.

Conventions for this checklist (from user validation 2026-05-29):
- "detail" = **one file per area** at `documentation/services/web/<area>.md` (not a folder).
- **Agents never `git commit`** — the user reviews and commits each file by hand. `git mv`/
  `git rm` of staged legacy files is allowed (stages only).
- **No `wc_2022` as current** — document the 2026 path only; deprecate 2022 docs (banner).

---

## Phase 0 — Scaffolding (main thread)

| # | Task | Produce | Exit |
|---|------|---------|------|
| `[x]` P0-1 | Create `context/` tree per plan §1 | all folders + one-line `README.md` per leaf | folders exist |
| `[x]` P0-2 | Create `documentation/` tree per plan §1 | all folders + one-line `README.md` per leaf | folders exist |
| `[x]` P0-3 | Verify `.gitignore` doesn't exclude new trees | (note) | confirmed — no exclusion of `context/` or `documentation/` |

---

## Phase 1 — Foundational platform context

Verify against: `package.json`, `uv.lock`/`pyproject.toml`, `supabase/config.toml`,
`supabase/migrations/*`, `src/lib/supabase/*`, `eslint.config.mjs`, `.prettierrc.json`,
`README.md`, `Makefile`, `.env.example`.

| # | Area | Source files (`*-old`) | Produce | Action | Exit |
|---|------|------------------------|---------|--------|------|
| `[x]` P1-1 | Doc instructions | (this kit) | `context/00-documentation-instructions.md` | create | reflects real areas |
| `[x]` P1-2 | Complete overview | kit draft `00-project-complete-overview.md`, `context-old/initial-setup/02-pid.md` | `context/00-project-complete-overview.md` | update | accurate, self-contained |
| `[x]` P1-3 | Project/domain | `context-old/initial-setup/01-brainstorming-prompt.md`, `02-pid.md`, `plan/01-plan.md` | `context/01-project.md` | update | scoring/locking corrected |
| `[x]` P1-4 | Tech stack | `plan/02-project-setup.md`, `python/01-python-setup.md` | `context/02-tech-stack.md` | update | versions from lockfiles |
| `[x]` P1-5 | App architecture | `README.md`, `plan/01-plan.md` §3 | `context/03-app-architecture.md` | update | matches `src/` tree, names `proxy.ts` |
| `[x]` P1-6 | Local development | `implementations/03-*`, `Makefile`, `.env.example` | `context/04-local-development.md` | migrate | db:start/reset/types:gen, make fecha |
| `[x]` P1-7 | Deployment | `README.md` Deploy, `plan/01-plan.md` §infra | `context/05-deployment.md` | update | preview/prod, manual db push |
| `[x]` P1-8 | Infra (Vercel+Supabase) | `plan/01-plan.md` §infra | `context/06-vercel-supabase-infrastructure.md` | create | LOCAL vs PROD crisp |
| `[x]` P1-9 | Database overview | `plan/04-database-schema.md`, `implementations/04-*` | `context/07-database.md` | update | post-migration accurate |
| `[x]` P1-10 | DB detail | migrations `*`, `database.types.ts` | `documentation/services/database/{tables,functions,rls,migrations}.md` | create | every table/fn/policy |
| `[x]` P1-11 | Security | `plan/05-auth-and-profiles.md`, migrations (RLS) | `context/08-security.md` | update | env-name only, no secrets |
| `[x]` P1-12 | Coding conventions | `eslint.config.mjs`, `.prettierrc.json`, code | `context/09-coding-conventions.md` | create | only enforced/observed rules |

---

## Phase 2 — Area agents (parallelisable)

Each task: `context/<area>/<entity>.md` overview (≤200 lines) **+** `documentation/services/web/<area>/` detail, cross-linked; migrate sources.

| # | Area | Source files (`*-old`) | Verify against (code) | Produce | Exit |
|---|------|------------------------|------------------------|---------|------|
| `[x]` P2-A | Auth & profiles | `plan/05-*`, `implementations/05-*`, `usuarios/02-admin.md` | `lib/auth/*`, `lib/permissions/*`, `app/(auth)/*`, `app/rules/*`, `*_handle_new_user.sql`, `proxy.ts` | `context/web/auth-and-profiles.md` + `documentation/services/web/auth-and-profiles.md` | cross-linked; sources consumed |
| `[x]` P2-B | Initial predictions | `plan/08-*`, `implementations/08-*` | `app/(app)/predictions/initial/*`, `lib/predictions/initialLock.ts`, `app/admin/evaluaciones/*`, `*_initial_predictions_*` | `context/web/initial-predictions.md` + detail | includes admin evaluaciones |
| `[x]` P2-C | Match predictions | `plan/09-*`, `implementations/09-*`, `documentation-old/user_guides/bloqueo_predicciones.md` | `app/(app)/predictions/matches/*`, `lib/predictions/matchLock.ts`, `*_match_predictions_*`, `is_fixture_locked` | `context/web/match-predictions.md` + detail; preserve `bloqueo_predicciones.md` → `documentation/user_guides/` | manual lock documented |
| `[x]` P2-D | Results entry | `plan/10-*`, `implementations/10-*`, `11b-*` | `app/admin/results/*`, knockout pairings action, `*_match_results_*` | `context/web/results-entry.md` + detail | deriveResult + pairings + round lock |
| `[x]` P2-E | Scoring engine | `plan/11-*`, `implementations/11-*`, `documentation-old/user_guides/puntuacion.md` | `lib/scoring/*`, `scripts/scoring/smoke-recalc.ts`, `scoring_rules` migrations | `context/web/scoring-engine.md` + detail; preserve `puntuacion.md` → `documentation/user_guides/` | values = 200/150/100/100/25 etc. |
| `[x]` P2-F | Leaderboards & visuals | `plan/12-*`, `implementations/12-*` | `app/(app)/clasificacion/*`, `app/(app)/my-scores/*`, `components/scoring/*`, `lib/scoring/{leaderboard,maxPoints,breakdownLabels}.ts` | `context/web/leaderboards.md` + detail | all clasificacion views |
| `[x]` P2-G | Fixtures admin | `plan/07-*`, `implementations/07-*`, `prompts/admin-fixtures-import.md`, `context-old/fixtures/octavos.json` | `app/admin/fixtures/*`, `lib/fixtures/*`, `lib/dates/madridTime.ts` | `context/web/fixtures-admin.md` + detail + `documentation/implementations/admin-fixtures-json-import.md` | import how-to consolidated |
| `[x]` P2-H | Admin reset & rules | `plan/14-admin-reset-and-rules.md` (plan only) | `app/admin/reset/*`, `app/admin/reglas/*` | `context/web/admin-reset-and-rules.md` + detail | **written from code** (no journal) |
| `[x]` P2-I | Master data & seeding (2026 only) | `plan/06-*`, `implementations/06-*`, `11b-*`, `python/01-python-setup.md`, `usuarios/01-fake-users.json` | `scripts/wc2026/*`, `data/raw/*` (2026), `data/seeds/wc_2026/*`, `lib/fixtures/catalogs.ts` | `context/data/seeding-and-master-data.md` + `documentation/services/data-tooling/{python-pipeline,seed-scripts}.md` | 2026 only; `scripts/wc2022` NOT documented (deprecate) |
| `[x]` P2-J | Shared (clients/dates/locking) | `implementations/03-*`, `bloqueo_predicciones.md` | `lib/supabase/*`, `lib/dates/*`, `app_now`/`is_fixture_locked`/`are_initial_*` | `context/shared/{supabase-clients,dates-and-timezone,prediction-locking}.md` | app_now/FECHA_ACTUAL clear |
| `[x]` P2-K | UI & design (canonical) | `plan/15-ui-design-spanish.md`, `plan/99-color-palette.md` | hito 16 commits, `globals.css`, `app/layout.tsx`, `components/layout/*`, `components/ui/*` | `context/web/ui-and-design.md` + `documentation/services/web/ui-and-design.md` | palette + Plus Jakarta + no dark mode + navbar/dashboard; `09-coding-conventions.md` links here (no dup) |
| `[x]` P2-L | Avatars/profiles (full doc) | none | `components/profiles/Avatar.tsx`, `lib/profiles/avatars.ts`, `public/images/users/` | `context/web/avatars-profiles.md` + `documentation/services/web/avatars-profiles.md` | username = display_name = PNG filename; test David*.png until real usernames |

---

## Phase 3 — Index, READMEs, root meta

| # | Task | Produce | Exit |
|---|------|---------|------|
| `[x]` P3-1 | Rebuild index | `context/00-index.md` (every file, one line) | complete |
| `[x]` P3-2 | Root README | `README.md` points into `context/`/`documentation/` | updated, links valid |
| `[x]` P3-3 | `.claude/CLAUDE.md` | `git mv CLAUDE.md .claude/CLAUDE.md`, rewrite to point into new trees; un-ignore `.claude/` in `.gitignore` but keep `.claude/settings.local.json` ignored | aligned with context/+documentation/; user commits |

---

## Phase 4 — Cleanup

| # | Task | Exit |
|---|------|------|
| `[x]` P4-1 | Consume remaining `*-old` files → archive/deprecated/delete (logged) | `context-old/`+`documentation-old/` empty |
| `[x]` P4-2 | `git rm -r context-old documentation-old` | removed |
| `[x]` P4-3 | Dead-link scan: no refs to `docs/`, `context-old/`, `documentation-old/`, `prompts/` | clean |
| `[x]` P4-4 | Confirm `prompts/` removed (content in `documentation/implementations/admin-fixtures-json-import.md`) | gone |
| `[x]` P4-5 | Scoped `git diff` over `src/ supabase/ scripts/ data/` configs = empty | Phase 4 made no code edits; branch may still diff vs HEAD from earlier work |
| `[x]` P4-6 | `git mv docs-migration context/archive/docs-migration` | kit archived |
| `[x]` P4-7 | Final pass: `00-index.md` + `00-project-complete-overview.md` current | accepted |

> Reminder: agents stage these moves (`git mv`/`git rm`) but do **not** commit; the user commits.

---

## Legacy source inventory (for completeness — every `*-old` file gets a home)

`context-old/`: `initial-setup/{01-brainstorming-prompt,02-pid}.md` · `plan/{0-plan-prompt,
01-plan,02-project-setup,03-supabase-local-and-migrations,04-database-schema,05-auth-and-
profiles,06-seed-and-import-master-data,07-admin-fixtures,08-bootstrap-prompt,08-initial-
predictions,09-match-predictions,10-admin-results-entry,11-scoring-engine,11b-wc2026-and-
knockout-sampling,12-leaderboards-and-visuals,14-admin-reset-and-rules,15-ui-design-spanish,
99-color-palette}.md` · `implementations/{02..12,11b}-*-implementation.md` ·
`python/01-python-setup.md` · `usuarios/{01-fake-users.json,02-admin.md}` ·
`fixtures/octavos.json`

`documentation-old/`: `user_guides/{puntuacion,bloqueo_predicciones}.md`

Also outside `*-old`: `prompts/admin-fixtures-import.md` → consolidate into
`documentation/implementations/admin-fixtures-json-import.md`, then `git rm` it and remove the
`prompts/` folder.

Destinations (decided):
- → `documentation/archive/` (no banner): `plan/0-plan-prompt.md`, `plan/08-bootstrap-prompt.md`,
  `initial-setup/01-brainstorming-prompt.md`, `initial-setup/02-pid.md` (after extraction),
  `plan/01-plan.md` (after extraction), a one-line hito-13 note, `usuarios/*`, `fixtures/octavos.json`.
- → `documentation/deprecated/` (BANNER): anything describing Catar 2022 / `wc_2022_test`, the
  24h auto-lock, `120'` goals, and dark mode.
- The 2026 content is extracted into the live `context/`/`documentation/` files per Phase 2.
