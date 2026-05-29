# Documentation Index

One-line map of every file in `context/` and `documentation/`. Read [`00-documentation-instructions.md`](00-documentation-instructions.md) before adding entries.

## context/ — meta & platform

- `00-documentation-instructions.md` — where each kind of doc goes; two-folder model; prime directive
- `00-index.md` — this file (TOC of both trees)
- `00-project-complete-overview.md` — self-contained whole-project orientation (paste to onboard an LLM)
- `01-project.md` — domain, users, predictions, scoring summary, out-of-scope items
- `02-tech-stack.md` — locked versions from lockfiles (Next, Supabase, Python tooling)
- `03-app-architecture.md` — single-app module breakdown: routes, lib, components, scripts
- `04-local-development.md` — local Supabase, npm run dev, db:reset, types:gen, make fecha
- `05-deployment.md` — Vercel preview/prod on master; manual supabase db push
- `06-vercel-supabase-infrastructure.md` — hosting model; LOCAL vs PROD Supabase distinction
- `07-database.md` — tables, RLS model, functions, migration policy (overview)
- `08-security.md` — auth model, RLS posture, env-var names, no secrets
- `09-coding-conventions.md` — server actions, zod, supabase clients, Spanish UI / English code

## context/implementations/

- `implementations/README.md` — dated journal conventions for vibe-coded features
- `implementations/00-implementation-index.md` — master index of implementation journals (empty until first entry)

## context/web/

- `web/README.md` — pointer to web feature overviews
- `web/auth-and-profiles.md` — Supabase Auth, profiles, roles, terms acceptance, header
- `web/initial-predictions.md` — champion, runner-up, pichichi, mejor jugador, clasificados, evaluaciones
- `web/match-predictions.md` — per-fixture predictions, manual jornada lock, public view
- `web/results-entry.md` — admin results, deriveResult, round lock, knockout pairings
- `web/scoring-engine.md` — recalculateCore, rules v1, breakdown, smoke script
- `web/leaderboards.md` — clasificacion views, my-scores, breakdown popovers, evolution chart
- `web/fixtures-admin.md` — admin fixtures CRUD, JSON import, Madrid timezone, pythonFormat schema
- `web/admin-reset-and-rules.md` — tournament data reset (BORRAR), scoring rules versioning + recalc
- `web/ui-and-design.md` — palette tokens, fonts, floating header, home dashboard, shared UI components
- `web/avatars-profiles.md` — username-keyed PNG avatars, Avatar/ParticipantBadge, admin workflow

## context/data/

- `data/README.md` — pointer to seeding overview
- `data/seeding-and-master-data.md` — wc_2026 JSON seeds, upload flow, gen-fixtures, Python tooling role

## context/shared/

- `shared/README.md` — pointer to shared overviews
- `shared/supabase-clients.md` — browser/server/admin clients, proxy session refresh, types:gen
- `shared/dates-and-timezone.md` — UTC storage, Madrid display, FECHA_ACTUAL / app_now()
- `shared/prediction-locking.md` — manual admin locks, is_fixture_locked, are_initial_predictions_locked

## context/archive/

- `archive/README.md` — historical context; points to archived migration kit

## documentation/

- `documentation/README.md` — layout of the documentation tree (engineer-first detail)

## documentation/services/

- `services/README.md` — code-level detail per logical module
- `services/web/README.md` — pointer to web feature detail files
- `services/web/auth-and-profiles.md` — auth routes, actions, proxy gate, handle_new_user, terms flow
- `services/web/initial-predictions.md` — initial + gqp forms, lock, public view, admin evaluaciones
- `services/web/match-predictions.md` — MatchesForm, save actions, matchLock, LockedFixturePanel
- `services/web/results-entry.md` — ResultForm, deriveResult, confirm/draft, pairings, random results
- `services/web/scoring-engine.md` — scoreMatch, scoreInitial, scoreGroup, recalculateCore, rules JSON
- `services/web/leaderboards.md` — leaderboard.ts aggregations, clasificacion routes, scoring UI components
- `services/web/fixtures-admin.md` — admin fixtures routes, import resolver, madridTime, pythonFormat
- `services/web/admin-reset-and-rules.md` — reset delete order, reglas actions, RulesEditor fields
- `services/web/ui-and-design.md` — globals.css tokens, layout shell, HeaderClient, ui/* components
- `services/web/avatars-profiles.md` — avatarUrlFor, Avatar, ParticipantBadge, public/images/users
- `services/database/README.md` — schema detail index
- `services/database/tables.md` — every table, columns, FKs, constraints
- `services/database/functions.md` — is_admin, app_now, is_fixture_locked, are_initial_*, handle_new_user
- `services/database/rls.md` — policy model per table
- `services/database/migrations.md` — naming, ordering, local reset vs prod push
- `services/data-tooling/README.md` — pointer to data-tooling detail files
- `services/data-tooling/python-pipeline.md` — uv/pandas CSV tooling, utils.py, legacy partidos notes
- `services/data-tooling/seed-scripts.md` — wc2026 upload, gen-fixtures, upserts, env guards, SQL checks

## documentation/user_guides/ (Spanish)

- `user_guides/README.md` — Spanish user-facing guides for players
- `user_guides/puntuacion.md` — scoring rules for players (code-aligned)
- `user_guides/bloqueo_predicciones.md` — manual per-jornada prediction locking

## documentation/implementations/

- `implementations/README.md` — stable topic how-tos (not dated journals)
- `implementations/admin-fixtures-json-import.md` — ChatGPT prompt + workflow for bulk knockout import
- `implementations/wc2026-clean-slate-and-users.md` — prod clean-slate + 15-account creation + forced-password runbook
- `implementations/pending-prod-migrations.md` — running tracker of local→prod migrations + deploy steps

## documentation/issues/

- `issues/README.md` — incidents and troubleshooting runbooks
- `issues/deployment/README.md` — prod migration push and deployment runbooks (stub)
- `issues/local-dev/README.md` — Supabase Docker quirks, FECHA_ACTUAL testing (stub)

## documentation/deprecated/

- `deprecated/README.md` — removed/superseded features (banner required on each file)
- `deprecated/wc2022-seed-and-sync.md` — retired wc_2022_test / scripts/wc2022 (superseded by wc_2026)
- `deprecated/dark-mode.md` — removed dark mode (hito 15); light mode only

## documentation/archive/

- `archive/README.md` — never-built explorations and historical records (no banner)
- `archive/0-plan-prompt.md` — meta-prompt that created the milestone plan tree
- `archive/01-brainstorming-prompt.md` — original product brainstorming (pre-PID)
- `archive/01-plan.md` — master roadmap index (hitos 02–16; historical)
- `archive/02-pid.md` — product intent document (PID)
- `archive/01-python-setup.md` — legacy uv/pyenv setup note (absorbed into python-pipeline.md)
- `archive/02-project-setup-plan.md` — hito 02 plan (Next.js scaffold)
- `archive/02-project-setup-implementation.md` — hito 02 implementation journal
- `archive/04-database-schema-plan.md` — hito 04 plan (schema + RLS)
- `archive/04-database-schema-implementation.md` — hito 04 implementation journal
- `archive/hito-13-deleted.md` — note: hito 13 removed from roadmap
- `archive/03-supabase-local-and-migrations-plan.md` — hito 03 plan (clients, migrations)
- `archive/03-supabase-local-and-migrations-implementation.md` — hito 03 implementation journal
- `archive/05-auth-and-profiles-plan.md` — hito 05 plan (auth, profiles, RLS)
- `archive/05-auth-and-profiles-implementation.md` — hito 05 implementation journal
- `archive/06-seed-and-import-master-data-plan.md` — hito 06 plan (seeds; wc_2022 era)
- `archive/06-seed-and-import-master-data-implementation.md` — hito 06 implementation journal
- `archive/07-admin-fixtures-plan.md` — hito 07 plan (fixtures admin)
- `archive/07-admin-fixtures-implementation.md` — hito 07 implementation journal
- `archive/08-bootstrap-prompt.md` — meta-prompt for bootstrapping later hitos
- `archive/08-initial-predictions-plan.md` — hito 08 plan (initial predictions)
- `archive/08-initial-predictions-implementation.md` — hito 08 implementation journal
- `archive/09-match-predictions-plan.md` — hito 09 plan (match predictions)
- `archive/09-match-predictions-implementation.md` — hito 09 implementation journal
- `archive/10-admin-results-entry-plan.md` — hito 10 plan (results entry)
- `archive/10-admin-results-entry-implementation.md` — hito 10 implementation journal
- `archive/11-scoring-engine-plan.md` — hito 11 plan (scoring engine)
- `archive/11-scoring-engine-implementation.md` — hito 11 implementation journal
- `archive/11b-wc2026-and-knockout-sampling-plan.md` — hito 11b plan (wc_2026 migration, pairings)
- `archive/11b-wc2026-and-knockout-sampling-implementation.md` — hito 11b implementation journal
- `archive/12-leaderboards-and-visuals-plan.md` — hito 12 plan (leaderboards)
- `archive/12-leaderboards-and-visuals-implementation.md` — hito 12 implementation journal
- `archive/14-admin-reset-and-rules-plan.md` — hito 14 plan (reset + reglas; code-only journal)
- `archive/15-ui-design-spanish-plan.md` — hito 15 plan (UI consolidation, Spanish copy)
- `archive/99-color-palette.md` — exploratory palette source (absorbed into ui-and-design)
- `archive/octavos-fixture-sample-wc2022.json` — wc2022 knockout import sample payload
- `archive/usuarios-01-fake-users.json` — legacy test user seed JSON
- `archive/usuarios-02-admin.md` — legacy admin promotion SQL snippet

## context/archive/docs-migration/

- `archive/docs-migration/documentation-migration-plan.md` — target structure, phases, rules
- `archive/docs-migration/docs-migration-checklist.md` — task tracker (migration complete)
- `archive/docs-migration/project-context.md` — orientation primer for migration agents
- `archive/docs-migration/deletions-log.md` — legacy file consumption log
- `archive/docs-migration/00-project-complete-overview.md` — draft source for context/00-project-complete-overview.md
- `archive/docs-migration/agent-prompt-phase1-template.md` — Phase 1 agent instructions
- `archive/docs-migration/agent-prompt-phase2-template.md` — Phase 2 agent instructions
- `archive/docs-migration/agent-prompt-phase3-template.md` — Phase 3 agent instructions
- `archive/docs-migration/doc-migration-system-prompt.md` — generic migration system prompt
