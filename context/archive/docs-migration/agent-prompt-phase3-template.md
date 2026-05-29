# Agent Prompt — Phase 3 / 4 (Index, Root Meta, Cleanup)

Task ID: `<FILL ME IN>`  (e.g. P3-1, P4-3)

Final-stage work for the **World Cup Sweepstake** docs migration. Documentation-only: never
change application code, SQL, configs, scripts, or `.env*`. (Allowed: Markdown, root
`README.md`, `.claude/CLAUDE.md`, `.gitignore`, and comment-only edits to `Makefile`/CI that
reference moved doc paths.)

## Read first
1. `docs-migration/project-context.md`
2. `docs-migration/documentation-migration-plan.md` (§6 acceptance, §7 finishing)
3. `docs-migration/docs-migration-checklist.md` → your task row.
4. The full `context/` and `documentation/` trees as they now stand.

## Tasks in this stage

**Index (`context/00-index.md`):** one table of contents listing EVERY file in `context/`
and `documentation/`, one line each, grouped by tree/folder, with a one-line description.

**Root `README.md`:** keep it short; point readers into `context/` (start at
`00-project-complete-overview.md` and `00-index.md`) and `documentation/`. Fix any links that
pointed at old paths (e.g. `context/plan/01-plan.md`).

**`.claude/CLAUDE.md`:** `git mv CLAUDE.md .claude/CLAUDE.md` (it currently just holds
`@AGENTS.md`). Make it the Vibe Coding entry point — explain the two-folder model briefly and
link into `context/00-documentation-instructions.md`, `00-index.md`, and the main area overviews
so an agent knows how to deep-dive (keep `@AGENTS.md` reference). Un-ignore `.claude/` in
`.gitignore` but keep `.claude/settings.local.json` ignored (local-only override).

**Cleanup (Phase 4):**
- Confirm every `*-old` file has been consumed; `git rm -r context-old documentation-old`.
- Dead-link scan: grep the repo for `docs/`, `context-old/`, `documentation-old/`,
  `plan/01-plan.md` and similar; fix or remove stray references.
- Scoped `git diff` over `src/`, `supabase/`, `scripts/`, `data/`, and config files — must be
  **empty** (no code changed). Report the result.
- `git mv docs-migration context/archive/docs-migration`.
- Final pass: `00-index.md` + `00-project-complete-overview.md` are current.

## Wrap up
**Never `git commit`** — stage moves with `git mv`/`git rm`; the user commits by hand.
Flip your checkbox(es) to `[x]`. Final reply: what changed, the dead-link scan result, the
scoped `git diff` result (must show no code changes), and any remaining open question.
