# Documentation Migration Plan — World Cup Sweepstake

> **Status:** PLAN (Phase awaiting user validation). This run produced the *kit*, not the
> migrated docs. No `context/` or `documentation/` tree has been created yet, and no code or
> infra has changed. See **§ Open Questions** at the end before any migration begins.

## 0. Mode in effect — Appendix A (`*-old` rename), already staged

The repo already contains `context/` and `documentation/` — they have **already been renamed**
to `context-old/` and `documentation-old/` (git-tracked, committed). So:

- **Staging is DONE.** Do not run `git mv` for staging. Legacy source lives in
  `context-old/` and `documentation-old/`.
- All "Source files" references in this kit point at `context-old/...` /
  `documentation-old/...` (never `docs/`).
- Cleanup target (§ Finishing): `context-old/` and `documentation-old/` must end **empty and
  removed** (`git rm -r`), and a dead-link scan must find no stray `*-old/` references.
- This migration kit currently lives in `docs-migration/`. At the very end it moves to
  **`context/archive/docs-migration/`** (the new `context/`).

## PRIME DIRECTIVE (binding for every agent)

Documentation-only. Edit only Markdown under the new `context/`/`documentation/` trees, the
legacy `*-old/` staging, this kit, `README.md`, and `.gitignore`/comment-only Makefile edits
if they reference moved doc paths. **Never touch** application code, SQL migrations,
`supabase/config.toml`, `package.json`, scripts, `.env*`, or any source file. Read code
freely; change it never. If a doc claim can't be reconciled because the *code* looks wrong,
raise an open question — do not patch code. A scoped `git diff` over `src/`, `supabase/`,
`scripts/`, `data/`, configs must show **no changes** at the end.

---

## 1. Target structure (this repo, concrete)

This is a **single deployable** (one Next.js app on Vercel + one Supabase project). We keep
`documentation/services/` with three logical modules — `web`, `database`, `data-tooling` —
rather than flattening, because the three have genuinely different audiences.

### `context/` (LLM-first, short, ≤ ~200 lines per entity file)

```
context/
├── 00-documentation-instructions.md   # the "where does this go?" guide (§1.5 of system prompt)
├── 00-index.md                        # TOC of every context/ + documentation/ file
├── 00-project-complete-overview.md    # one-shot whole-project overview (draft already in kit)
├── 01-project.md                      # what it is, who uses it, the porra domain
├── 02-tech-stack.md                   # locked versions (package.json, supabase major_version 17, uv/python)
├── 03-app-architecture.md             # single-app module breakdown: routes, lib, components, scripts, data
│                                      #   (this is the "03-services-overview" slot, renamed — one service)
├── 04-local-development.md            # local Supabase, npm run dev, db:reset, types:gen, make fecha
├── 05-deployment.md                   # Vercel preview/prod on master; manual supabase db push
├── 06-vercel-supabase-infrastructure.md # hosting model; LOCAL vs PROD Supabase distinction (no AWS file)
├── 07-database.md                     # tables, RLS model, functions, migration policy (overview)
├── 08-security.md                     # auth model, RLS posture, env-var/secret layout, no committed secrets
├── 09-coding-conventions.md           # server actions, zod, 3 supabase clients, Spanish UI/English code
├── implementations/
│   ├── README.md
│   └── 00-implementation-index.md     # (dated journal lives here going forward; seeded empty)
├── web/                               # one overview file per feature area (≤ ~200 lines each)
│   ├── README.md
│   ├── auth-and-profiles.md
│   ├── initial-predictions.md
│   ├── match-predictions.md
│   ├── results-entry.md
│   ├── scoring-engine.md
│   ├── leaderboards.md
│   ├── fixtures-admin.md
│   ├── admin-reset-and-rules.md
│   ├── ui-and-design.md               # canonical UI doc (palette, Plus Jakarta Sans, no dark mode, navbar, dashboard)
│   └── avatars-profiles.md            # documented now (test names; real usernames swapped in later)
├── data/                              # master data + seeding overview (2026 only)
│   ├── README.md
│   └── seeding-and-master-data.md
├── shared/                            # cross-cutting capabilities
│   ├── README.md
│   ├── supabase-clients.md            # client/server/admin
│   ├── prediction-locking.md          # app_now / FECHA_ACTUAL + manual round lock + initial lock
│   └── dates-and-timezone.md          # appNow.ts, madridTime.ts
└── archive/
    ├── README.md
    └── docs-migration/                # THIS kit, moved here at the end
```

### `documentation/` (engineer-first, exhaustive)

```
documentation/
├── README.md
├── services/
│   ├── README.md
│   ├── web/                           # ONE file per feature area (decision: easy to locate)
│   │   ├── README.md
│   │   ├── routing.md                 # route groups (app)/(auth)/admin, proxy.ts (NOT middleware.ts)
│   │   ├── auth-and-profiles.md       # actions, permissions, handle_new_user, /rules + terms
│   │   ├── initial-predictions.md     # page/schemas/actions, initialLock.ts, evaluaciones admin
│   │   ├── match-predictions.md       # page/schemas/actions, MatchesForm, matchLock.ts, public view
│   │   ├── results-entry.md           # admin/results, deriveResult, knockout pairings, round lock
│   │   ├── scoring-engine.md          # lib/scoring/* functions, recalculateCore, rules JSON, smoke
│   │   ├── leaderboards.md            # clasificacion/* routes, my-scores, breakdown components
│   │   ├── fixtures-admin.md          # admin/fixtures CRUD + JSON import, catalogs, madridTime
│   │   ├── admin-reset-and-rules.md   # admin/reset, admin/reglas
│   │   ├── ui-and-design.md           # palette, Plus Jakarta Sans, no dark mode, navbar, dashboard (canonical UI doc)
│   │   └── avatars-profiles.md        # avatars feature (test names now, real usernames later)
│   ├── database/
│   │   ├── README.md
│   │   ├── tables.md                  # every table + columns + FKs + constraints
│   │   ├── functions.md               # is_admin, app_now, is_fixture_locked, are_initial_*, handle_new_user, set_updated_at
│   │   ├── rls.md                     # policy model per table
│   │   └── migrations.md              # naming, ordering, local reset vs prod push policy
│   └── data-tooling/
│       ├── README.md
│       ├── python-pipeline.md         # data/raw CSV→JSON (uv, pandas) — 2026 only
│       └── seed-scripts.md            # scripts/wc2026 upload/download, env — DO NOT document scripts/wc2022 (deprecated, slated for code removal)
├── user_guides/                       # preserved as-is: Spanish, code-aligned, user-facing
│   ├── puntuacion.md
│   └── bloqueo_predicciones.md
├── issues/
│   ├── README.md
│   ├── deployment/                    # manual prod migration push runbook
│   └── local-dev/                     # Supabase Docker 127.0.0.1→LAN IP quirk; FECHA_ACTUAL testing
├── implementations/                   # stable topic how-tos
│   ├── README.md
│   ├── admin-fixtures-json-import.md  # consolidate prompts/admin-fixtures-import.md
│   ├── time-simulation-fecha-actual.md
│   ├── scoring-recalculation.md
│   └── knockout-pairings-generation.md
├── deprecated/                        # built/decided then removed — BANNER REQUIRED
│   └── README.md                      #   24h auto-lock; 120' goals; dark mode
└── archive/                           # never built / historical — no banner
    └── README.md                      #   hito 13 (deleted); Gemini/scraping; brainstorming; old PID/plan drafts
```

---

## 2. Universal rules (concrete)

1. **Language:** produced docs in **English**. Keep domain nouns verbatim (`pichichi`,
   `mejor jugador`, `prórroga`, `penaltis`, `empate`, `predicción`, `porra`, `jornada`,
   `octavos`, `clasificados`, `fase de grupos`, …) and every code/route/DB identifier.
   `documentation/user_guides/*.md` stay in **Spanish** (user-facing, already code-aligned).
2. **Code-truth wins.** Re-derive every number/behavior from code. Known stale spots:
   scoring values (use 200/150/100/100/25 etc.), locking (manual per-jornada, not 24h),
   dropped `120'`, removed dark mode. See `project-context.md`.
3. **No duplication.** Consolidate the two docs per topic (plan + implementation) into one
   overview (`context/`) + one detail (`documentation/`); archive/delete the rest with a log
   entry. Never repeat platform context (`00–09`) inside entity files — link.
4. **One file = one topic.** Split mixed plan/implementation/log files: architecture →
   `context/web` + `documentation/services`, troubleshooting → `documentation/issues`,
   personal narrative → `archive`.
5. **Cross-link both ways.** Every `context/<area>/<entity>.md` ends with "Where to look
   deeper" → its `documentation/...` detail + sibling entities. Every `documentation/` detail
   file opens with `> Context:` linking up.
6. **Archive vs Deprecated** per system prompt §1.4. Banner on every `deprecated/` file:
   `> **DEPRECATED (YYYY-MM-DD).** {why}. Superseded by: {link or "feature removed"}.`
7. **Never touch application code.** Markdown + README + `.gitignore`/comment-only Makefile.
8. **No secrets.** Reference env **names** only (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
   `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG`, `FECHA_ACTUAL`). Never copy `.env.local` values.
9. **No emojis** (except when quoting existing user-facing copy verbatim), no marketing tone,
   no "then X broke" narrative. Terse, factual, skimmable.
10. **Surface gaps as open questions.** When current state is unclear from code, stub +
    archive (don't delete) and state the question in the final reply.
11. **`CLAUDE.md` lives in `.claude/`** (per EXTRA_CONTEXT) and must point into `context/` +
    `documentation/` so Vibe Coding deep-dives land in the right place. Move root `CLAUDE.md`
    (currently just `@AGENTS.md`) to `.claude/CLAUDE.md`, and un-ignore `.claude/` in
    `.gitignore` (keep `.claude/settings.local.json` ignored — that's the local-only override).
12. **No `wc_2022` in produced docs.** The project moved fully to the real 2026 calendar; 2022
    was only an early test. Document the **2026** path only. Any legacy doc that talks about
    Catar 2022 / `wc_2022_test` → `documentation/deprecated/` with a banner (it described real
    past behavior). Do **not** describe `scripts/wc2022/`, `data/raw/*2022*`, `data/seeds/
    wc_2022`, or the `wc_2022_test` tournament as current. (Removing 2022 from the **code** is a
    separate non-documentation task — see §8.)
13. **Agents NEVER commit.** The user reviews and commits every file by hand. Agents may use
    `git mv`/`git rm` to relocate/remove staged legacy files (these stage, they don't commit),
    but must never run `git commit`. No `git add` of unrelated paths, no branch creation.

---

## 3. Gap analysis

Legend — Verdict: **migrate** (good source, align to code) · **update** (stale, fix against
code) · **create** (little/no source, write from code).

| Area | Has docs? | Quality | Verdict |
|------|-----------|---------|---------|
| Project / domain (01) | yes (PID, brainstorming) | rich but partly stale (scoring) | update |
| Tech stack (02) | partial (scattered in plans) | ok | update from lockfiles |
| App architecture (03) | partial (README, 01-plan) | ok | update |
| Local development (04) | yes (03-impl, Makefile) | good | migrate |
| Deployment (05) | partial (README, 01-plan §infra) | thin | update |
| Vercel+Supabase infra (06) | partial | thin; local-vs-prod not crisp | create/update |
| Database (07) | yes (04-plan/impl) | good but pre-dates later migrations | update |
| Security/RLS (08) | partial (04, 05) | ok | update |
| Coding conventions (09) | partial (02, eslint/prettier) | inferred | create from configs |
| Auth & profiles | yes (05) | good | migrate |
| Master data & seeding | yes (06, 11b) | good | migrate |
| Fixtures admin | yes (07) | good | migrate |
| Initial predictions | yes (08) + evaluaciones | good; eval added later | update |
| Match predictions | yes (09) | good | migrate |
| Results entry | yes (10) | good | migrate |
| Scoring engine | yes (11) + puntuacion.md | good; values updated since | update |
| Leaderboards & visuals | yes (12) | good | migrate |
| Admin reset & rules (hito 14) | plan only, **no journal**; code shipped | code-truth needed | create from code |
| UI design (hitos 15/16) | plan (15) only; 16 code-only | partial | create from code/commits |
| Avatars / profiles | **none** (untracked code) | n/a | **create from code (full doc)** |
| Prediction locking (app_now) | yes (bloqueo_predicciones.md) | good, code-aligned | migrate |
| Python data pipeline | partial (python/01-setup) | ok | update (2026 only) |
| Catar 2022 / `wc_2022_test` | scattered in plans/scripts | obsolete | **deprecate (banner); never describe as current** |

---

## 4. Phases & order of execution

- **Phase 0 — Scaffolding** (main thread, no sub-agents). Create the empty `context/` +
  `documentation/` trees from §1 with a one-line `README.md` in each leaf folder. Verify
  `.gitignore` does not exclude `context/`/`documentation/`. *Output only; no migration.*
- **Phase 1 — Foundational platform context** (`context/00–09` + complete-overview +
  `00-documentation-instructions.md`). Must come first; everything links back to it. Also
  seed `documentation/services/database/*` since many areas reference it.
- **Phase 2 — Area agents** (parallelisable, one task per area). Each produces the
  `context/<area>/<entity>.md` overview **and** the `documentation/services/...` detail,
  consumes its legacy `*-old` sources (`git rm` once absorbed, or `git mv` to
  archive/deprecated), cross-links, and appends to `deletions-log.md`. Group functional units
  together (e.g. scoring engine + `puntuacion.md`; locking + `bloqueo_predicciones.md`).
- **Phase 3 — Index, READMEs, root meta.** Rewrite `00-index.md`, root `README.md`, and the
  `.claude/CLAUDE.md` so it points into the new trees.
- **Phase 4 — Cleanup.** Verify `context-old/`/`documentation-old/` are empty and `git rm -r`
  them; dead-link scan (no `docs/`, no `*-old/`); confirm no code changed; move
  `docs-migration/` → `context/archive/docs-migration/`; finalize index + overview.

Suggested Phase 2 task grouping (see checklist for IDs):
P2-A auth+profiles · P2-B initial-predictions(+evaluaciones) · P2-C match-predictions(+locking
guide) · P2-D results-entry(+knockout pairings) · P2-E scoring-engine(+puntuacion.md) ·
P2-F leaderboards · P2-G fixtures-admin(+import how-to, retire `prompts/`) · P2-H admin-reset-
and-rules · P2-I master-data & seeding (2026 only; +python) · P2-J shared (supabase clients,
dates) · P2-K UI & design (canonical) · P2-L avatars/profiles (full doc).

> **Agents never commit.** They may `git mv`/`git rm` staged legacy files, but the user reviews
> and commits each produced file by hand. See rule §2.13.

---

## 5. Validation checklist (run per legacy file before calling it "active")

1. Does the code that implements this still exist at the cited path? (`ls`/grep first.)
2. Do the numbers/behaviors match the active migrations and `scoring_rules`? (re-derive)
3. Is it superseded by a later hito/migration? → `deprecated/` (banner) or `archive/`.
4. Is it a plan/prompt that never shipped? → `archive/`.
5. Does it mix topics? → split per rule §4.
6. Any secret values? → strip; reference env names only; flag if committed.

---

## 6. Acceptance criteria

- `context/` and `documentation/` exist per §1; every leaf has a `README.md`.
- `context/00-index.md` lists every file in both trees, one line each.
- `context/00-project-complete-overview.md` is accurate and self-contained.
- `context/00-documentation-instructions.md` reflects this repo's real areas.
- Each feature area has a ≤200-line `context/` overview + cross-linked `documentation/` detail.
- All stale numbers corrected to code-truth (scoring, locking, dropped features).
- `context-old/` and `documentation-old/` empty and removed; no dead links to `docs/`/`*-old/`.
- Scoped `git diff` over code/infra paths shows no changes.
- Kit archived under `context/archive/docs-migration/`.
- `.claude/CLAUDE.md` points into the new trees.

---

## 7. Resolved decisions (from user validation, 2026-05-29)

1. **Avatars/profiles:** document it **fully** from code. The current avatar images/names are
   test placeholders that will later be swapped for official usernames — note that, but still
   write the real feature doc (`context/web/avatars-profiles.md` + detail). Commit-able.
2. **`.claude/`:** un-ignore `.claude/` in `.gitignore` and move root `CLAUDE.md` →
   `.claude/CLAUDE.md`, pointing into the new trees. Keep `.claude/settings.local.json`
   ignored (local-only override). The user commits these.
3. **UI design (hitos 15/16):** write it in **both** places without duplicating —
   `context/web/ui-and-design.md` is the **canonical** UI doc (palette via `99-color-palette.md`,
   Plus Jakarta Sans, no dark mode, floating navbar, home dashboard); `09-coding-conventions.md`
   only **references** it for UI/styling rules.
4. **Catar 2022 / `wc_2022_test`:** fully retired. **Do not document 2022 as current** anywhere;
   move any 2022-specific legacy doc to `documentation/deprecated/` with a banner. Seeding docs
   cover the **2026** path only. (Purging 2022 from the **code** is a separate task — §8.)
5. **`prompts/` folder:** remove it. Consolidate `prompts/admin-fixtures-import.md` into
   `documentation/implementations/admin-fixtures-json-import.md` and `git rm` the original
   (the user commits the removal).
6. **Hito 13 (deleted resultados/estadísticas):** one-line note in `documentation/archive/`.
7. **`documentation/services/web/` granularity:** **one file per area** (e.g.
   `scoring-engine.md`), so a problem in one area maps to exactly one file.
8. **Commits:** **agents never commit.** The user reviews and commits each produced file by
   hand. Agents may `git mv`/`git rm` staged legacy files (stages only, no commit). This is
   baked into rule §2.13 and the agent templates.

---

## 8. Follow-up — non-documentation task (out of scope for the agents)

The user also wants **all `wc_2022` references removed from the code** (`scripts/wc2022/`,
`data/raw/*2022*`, `data/seeds/wc_2022/`, `data/partidos/2022/`, the `wc_2022_test` tournament,
any 2022 branches in `src/`). That is a **code change** and therefore **outside this
documentation-only migration** — the Prime Directive forbids the doc agents from touching code.

Handling: the docs migration treats 2022 as deprecated/removed (decision §7.4). The actual code
purge is tracked here as a **separate task to run after (or independently of) the docs
migration**, on its own branch, with its own verification (build + `npm run typecheck` +
`scoring:smoke` + a local `db:reset`). Do not bundle it into any Phase 0–4 agent.

---

> **READY.** Open questions resolved. The plan, checklist, per-phase templates,
> `project-context.md`, `deletions-log.md`, and the complete-overview draft are good enough for
> independent agents to execute Phases 0–4 without further clarification.
