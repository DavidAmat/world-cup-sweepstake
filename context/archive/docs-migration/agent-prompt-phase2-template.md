# Agent Prompt — Phase 2 (Area / Feature Agent)

Task ID: `<FILL ME IN>`  (e.g. P2-E)

You own ONE feature area of the **World Cup Sweepstake** docs migration. Documentation-only:
never change application code, SQL, configs, scripts, or `.env*`. Markdown only.

## Read first (in order)
1. `docs-migration/project-context.md`
2. `docs-migration/documentation-migration-plan.md` (§1 structure, §2 rules, §5 validation)
3. `docs-migration/docs-migration-checklist.md` → your task row (Source files, Verify-against,
   Produce, Exit).
4. The Phase 1 platform files in `context/00–09` (link to them; do not repeat them).
5. Your **Source files** under `context-old/`/`documentation-old/` and the **Verify-against**
   code paths.

## Rules (binding)
- **Code-truth wins.** Read the implementing code and align everything to it. Re-derive
  numbers. Stale spots to expect: scoring (use 200/150/100/100, group qualification 25,
  outcome 5 / exact 10 / distance 3-2-1 / diff 3 / prórroga 5 / penaltis 5 / qualified 8),
  manual per-jornada locking (not 24h), dropped `120'`, no dark mode. `ls`/grep before citing.
- English prose; domain nouns + code identifiers verbatim. `documentation/user_guides/*.md`
  stay **Spanish** (already user-facing and code-aligned) — migrate them as-is.
- **No duplication, one file = one topic.** Consolidate plan + implementation into:
  - `context/<area>/<entity>.md` — overview, **≤ ~200 lines**, "what it is / how it flows".
    End with a **"Where to look deeper"** section linking to the `documentation/` detail and
    sibling entities.
  - `documentation/services/web/<area>/...` — exhaustive detail (routes, server actions,
    schemas, components, lib functions, SQL touched, exact commands). Open each file with a
    `> Context:` link back up to the overview.
- **No secrets** (env names only). No emojis (except when quoting existing user copy), no
  marketing tone, no "then it broke" narrative.
- **Migrate legacy sources out of staging:** once a `*-old` file's content is absorbed,
  `git rm` it; if it's historical/never-built, `git mv` it to `documentation/archive/` (no
  banner) or `documentation/deprecated/` (REQUIRED banner:
  `> **DEPRECATED (YYYY-MM-DD).** {why}. Superseded by: {link or "feature removed"}.`).
  Log every move/delete in `docs-migration/deletions-log.md`.
- **Never `git commit`** (and don't create branches). `git mv`/`git rm` stage the change; that's
  fine — the user reviews and commits each file by hand.
- **No `wc_2022` as current.** Document the 2026 path only. Move any 2022-specific legacy doc to
  `documentation/deprecated/` with a banner. Do not describe `scripts/wc2022/`, 2022 seed data,
  or `wc_2022_test` as current. (Code-level 2022 removal is NOT your job — leave code untouched.)
- If current state is unclear from code: **stub + archive, never delete**, and raise it as an
  open question in your final reply.

## Produce
Exactly the files in your task's **Produce** column, cross-linked both ways.

## Wrap up
1. Append every consumed/moved/deleted source to `docs-migration/deletions-log.md`.
2. Add new files to `context/00-index.md`.
3. Flip your checkbox to `[x]` in the checklist.
4. Final reply: files written, sources consumed (with destinations), open questions + the safe
   default you took.
