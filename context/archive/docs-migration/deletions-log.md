# Deletions Log

Append-only. One bullet per legacy file deleted or moved to `archive/`/`deprecated/`.
Shape:

`- `<source>` → `<destination or "deleted">` (task `<ID>`) — <one-line reason>.`

> Empty until Phase 2+ executes. Agents append here as they consume `*-old` sources.

<!-- entries below -->

- `context-old/plan/05-auth-and-profiles.md` → `documentation/archive/05-auth-and-profiles-plan.md` (task P2-A) — content absorbed into context/web and documentation/services/web auth docs.
- `context-old/implementations/05-auth-and-profiles-implementation.md` → `documentation/archive/05-auth-and-profiles-implementation.md` (task P2-A) — hito 05 journal archived after extraction.
- `context-old/usuarios/02-admin.md` → `documentation/archive/usuarios-02-admin.md` (task P2-A) — admin promotion SQL snippet; canonical version in auth docs and context/04-local-development.
- `context-old/usuarios/01-fake-users.json` → `documentation/archive/usuarios-01-fake-users.json` (task P2-A) — test seed data; not part of current docs.
- `context-old/plan/08-initial-predictions.md` → `documentation/archive/08-initial-predictions-plan.md` (task P2-B) — content absorbed; stale on groups A–H and auto-lock.
- `context-old/implementations/08-initial-predictions-implementation.md` → `documentation/archive/08-initial-predictions-implementation.md` (task P2-B) — hito 08 journal archived after extraction.
- `documentation-old/user_guides/bloqueo_predicciones.md` → `documentation/user_guides/bloqueo_predicciones.md` (task P2-C) — preserved Spanish guide; added lock-from-predictions-page note.
- `context-old/plan/09-match-predictions.md` → `documentation/archive/09-match-predictions-plan.md` (task P2-C) — stale on 24h lock, 120' goals, per-round URL nav.
- `context-old/implementations/09-match-predictions-implementation.md` → `documentation/archive/09-match-predictions-implementation.md` (task P2-C) — hito 09 journal archived after extraction.
- `context-old/plan/10-admin-results-entry.md` → `documentation/archive/10-admin-results-entry-plan.md` (task P2-D) — stale on 120' goals and service-role client.
- `context-old/implementations/10-admin-results-entry-implementation.md` → `documentation/archive/10-admin-results-entry-implementation.md` (task P2-D) — hito 10 journal archived after extraction.
- `context-old/plan/11b-wc2026-and-knockout-sampling.md` → `documentation/archive/11b-wc2026-and-knockout-sampling-plan.md` (task P2-D) — wc_2026 migration + pairings; 2022 sections historical.
- `context-old/implementations/11b-wc2026-and-knockout-sampling-implementation.md` → `documentation/archive/11b-wc2026-and-knockout-sampling-implementation.md` (task P2-D) — hito 11b journal archived after extraction.
- `documentation-old/user_guides/puntuacion.md` → `documentation/user_guides/puntuacion.md` (task P2-E) — preserved Spanish scoring guide (code-aligned).
- `context-old/plan/11-scoring-engine.md` → `documentation/archive/11-scoring-engine-plan.md` (task P2-E) — stale multipliers and wc_2022 context.
- `context-old/implementations/11-scoring-engine-implementation.md` → `documentation/archive/11-scoring-engine-implementation.md` (task P2-E) — hito 11 journal archived after extraction.
- `context-old/plan/12-leaderboards-and-visuals.md` → `documentation/archive/12-leaderboards-and-visuals-plan.md` (task P2-F) — stale on general ranking page and fase/[stageCode] routes; content absorbed.
- `context-old/implementations/12-leaderboards-and-visuals-implementation.md` → `documentation/archive/12-leaderboards-and-visuals-implementation.md` (task P2-F) — hito 12 journal archived after extraction.
- `context-old/plan/07-admin-fixtures.md` → `documentation/archive/07-admin-fixtures-plan.md` (task P2-G) — stale on wc_2022_test, 24h lock, wc2022 scripts; content absorbed.
- `context-old/implementations/07-admin-fixtures-implementation.md` → `documentation/archive/07-admin-fixtures-implementation.md` (task P2-G) — hito 07 journal archived after extraction.
- `prompts/admin-fixtures-import.md` → `documentation/implementations/admin-fixtures-json-import.md` (task P2-G) — ChatGPT import prompt consolidated; prompts/ removed.
- `context-old/fixtures/octavos.json` → `documentation/archive/octavos-fixture-sample-wc2022.json` (task P2-G) — wc2022 test sample payload; not current tournament.
- `context-old/plan/14-admin-reset-and-rules.md` → `documentation/archive/14-admin-reset-and-rules-plan.md` (task P2-H) — plan only; written from code (no journal).
- `context-old/plan/06-seed-and-import-master-data.md` → `documentation/archive/06-seed-and-import-master-data-plan.md` (task P2-I) — wc_2022-focused plan; content absorbed into wc_2026 seeding docs.
- `context-old/implementations/06-seed-and-import-master-data-implementation.md` → `documentation/archive/06-seed-and-import-master-data-implementation.md` (task P2-I) — hito 06 journal archived after extraction.
- `context-old/python/01-python-setup.md` → `documentation/archive/01-python-setup.md` (task P2-I) — uv/pyenv setup absorbed into python-pipeline.md.
- `context-old/plan/03-supabase-local-and-migrations.md` → `documentation/archive/03-supabase-local-and-migrations-plan.md` (task P2-J) — clients/proxy/migrations; content in shared + platform context.
- `context-old/implementations/03-supabase-local-and-migrations-implementation.md` → `documentation/archive/03-supabase-local-and-migrations-implementation.md` (task P2-J) — hito 03 journal archived after extraction.
- `context-old/plan/15-ui-design-spanish.md` → `documentation/archive/15-ui-design-spanish-plan.md` (task P2-K) — hito 15 UI consolidation; content in ui-and-design docs.
- `context-old/plan/99-color-palette.md` → `documentation/archive/99-color-palette.md` (task P2-K) — palette source absorbed into globals.css docs; font notes exploratory.
- `scripts/wc2022/` → deleted (task P2-L cleanup) — wc_2022 retired; wc2026 only.
- `data/seeds/wc_2022/` → deleted (task P2-L cleanup) — 2022 seed JSON removed.
- `data/partidos/2022/` → deleted (task P2-L cleanup) — 2022 partidos extracts removed.
- `data/partidos/fase_grupos/partidos_fase_grupos_2026.json` → deleted (task P2-L cleanup) — duplicate non-upload JSON removed.
- `src/app/(app)/dashboard/page.tsx` → deleted (task P2-L cleanup) — home is `/` only.

## Phase 4 (P4-1)

- `context-old/initial-setup/01-brainstorming-prompt.md` → `documentation/archive/01-brainstorming-prompt.md` (task P4-1) — pre-PID brainstorming archived.
- `context-old/initial-setup/02-pid.md` → `documentation/archive/02-pid.md` (task P4-1) — PID archived after extraction to context/01-project.md.
- `context-old/plan/0-plan-prompt.md` → `documentation/archive/0-plan-prompt.md` (task P4-1) — plan-tree meta-prompt archived.
- `context-old/plan/01-plan.md` → `documentation/archive/01-plan.md` (task P4-1) — master roadmap archived after extraction.
- `context-old/plan/02-project-setup.md` → `documentation/archive/02-project-setup-plan.md` (task P4-1) — hito 02 plan archived.
- `context-old/implementations/02-project-setup-implementation.md` → `documentation/archive/02-project-setup-implementation.md` (task P4-1) — hito 02 journal archived.
- `context-old/plan/04-database-schema.md` → `documentation/archive/04-database-schema-plan.md` (task P4-1) — hito 04 plan archived.
- `context-old/implementations/04-database-schema-implementation.md` → `documentation/archive/04-database-schema-implementation.md` (task P4-1) — hito 04 journal archived.
- `context-old/` (remaining tracked files) → `documentation/archive/*` (tasks P2/P4-1) — staging tree emptied; directory removed.
- `documentation-old/` → removed (task P4-2) — user guides already at documentation/user_guides/; empty tree removed.
- `docs-migration/` → `context/archive/docs-migration/` (task P4-6) — migration kit archived.
