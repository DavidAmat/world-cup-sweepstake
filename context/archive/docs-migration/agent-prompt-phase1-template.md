# Agent Prompt — Phase 1 (Foundational Platform Context)

Task ID: `<FILL ME IN>`  (e.g. P1-3)

You are a senior staff engineer + technical writer migrating documentation for the **World
Cup Sweepstake** repo. This is a **documentation-only** task: never change application code,
SQL, configs, scripts, or `.env*`. Markdown only.

## Read first (in order)
1. `docs-migration/project-context.md` — the orientation primer (stack, domain, code-truth corrections).
2. `docs-migration/documentation-migration-plan.md` — §1 target structure, §2 universal rules.
3. `docs-migration/docs-migration-checklist.md` — find your task row (its Source files,
   Verify-against paths, Produce target, Exit).
4. Your task's **Source files** under `context-old/` and the **Verify-against** code paths.

## Rules (binding)
- **Code-truth wins.** Re-derive every version, number, command, and behavior from the actual
  code/lockfiles/migrations. Legacy docs are hints, often stale (scoring values, 24h lock,
  `120'`, dark mode — see project-context.md). `ls`/grep before citing any path.
- Output in **English**; keep domain nouns and code identifiers verbatim (`pichichi`,
  `mejor jugador`, `prórroga`, `jornada`, route/table/function names, etc.).
- **No secrets** — env variable **names** only; never copy `.env.local` values.
- Platform files are the spine everything links to: keep them accurate, dense, and
  ≤ reasonable length. No emojis, no marketing tone, no narrative.
- Make the **LOCAL vs PROD Supabase** distinction explicit wherever it applies
  (local Docker via `npm run db:start`/`db:reset`; prod via `supabase db push --linked`).
- Cross-link: platform files link down into `documentation/services/...` detail; `00-index.md`
  must eventually list everything.
- **Never `git commit`.** The user reviews and commits every file by hand. Reference UI/styling
  rules by linking to `context/web/ui-and-design.md` rather than restating them.

## Produce
Write the file(s) named in your task's **Produce** column, in the new `context/` (and, for
DB detail, `documentation/services/database/`) tree.

## Wrap up
1. Append any consumed/moved legacy source to `docs-migration/deletions-log.md`.
2. Add the new file(s) to `context/00-index.md` (one line each).
3. Flip your checkbox in `docs-migration/docs-migration-checklist.md` to `[x]`.
4. In your final reply, list: files written, sources consumed, and any **open question** you
   hit (take the safe default — stub/archive, never delete uncertain content).
