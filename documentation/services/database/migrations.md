> Context: [`context/07-database.md`](../../../context/07-database.md) · [`context/04-local-development.md`](../../../context/04-local-development.md) · [`context/05-deployment.md`](../../../context/05-deployment.md)

# Database Migrations

Versioned SQL in `supabase/migrations/`. Applied in lexicographic order by filename timestamp.

## Commands

| Command | Target | Effect |
|---------|--------|--------|
| `npm run db:reset` | **Local** | Drop DB, reapply all migrations + `seed.sql` |
| `npm run db:diff` | Local | Generate new migration from schema drift (`supabase db diff -f`) |
| `npm run db:push` | **Prod (linked)** | Apply pending migrations (`supabase db push --linked`) |
| `npm run types:gen` | Local | Regenerate `src/lib/supabase/database.types.ts` |

Prod push requires `supabase link --project-ref <ref>` after `supabase login`.

## Migration files (current)

| File | Content |
|------|---------|
| `20260507222918_enable_extensions.sql` | `pgcrypto`, `citext` |
| `20260508155423_tournaments_profiles_terms.sql` | Core tables + `is_admin`, `set_updated_at` |
| `20260508160333_master_data.sql` | teams, players, stages, rounds |
| `20260508164618_fixtures_and_results.sql` | fixtures, match_results, match_goals, player_match_stats + `is_fixture_locked` |
| `20260508164810_predictions.sql` | initial, group_qualification, match predictions |
| `20260508164954_scoring.sql` | scoring_rules, prediction_scores, leaderboard_snapshots |
| `20260508170251_handle_new_user.sql` | `handle_new_user` trigger |
| `20260515120000_initial_predictions_freetext_and_lock.sql` | Free-text pichichi/mejor jugador; lock helpers; RLS update |
| `20260516120000_app_now_override.sql` | `app_settings`, `app_now()` |
| `20260517120000_is_fixture_locked_app_now.sql` | `is_fixture_locked` → `app_now()` |
| `20260517130000_match_predictions_drop_120.sql` | Drop 120' columns from match_predictions |
| `20260517140000_match_results_drop_120.sql` | Drop 120' columns from match_results |
| `20260518120000_scoring_rules_seed_and_type_rename.sql` | `prediction_type` rename; seed v1 rules |
| `20260525120000_manual_round_predictions_lock.sql` | `rounds.predictions_locked_at`; manual `is_fixture_locked` |
| `20260526120000_initial_predictions_manual_lock.sql` | `tournaments.initial_predictions_locked_at` |
| `20260527120000_initial_predictions_admin_only_lock.sql` | Remove time-based initial lock |
| `20260528120000_initial_predictions_subjective_evaluation.sql` | `top_scorer_correct`, `best_player_correct` |
| `20260528130000_scoring_rules_group_qualification_25.sql` | Bump `team_correct` to 25 in active rules |

## Conventions

- **Timestamp prefix** — `YYYYMMDDHHMMSS_description.sql`; Supabase CLI generates this via `supabase migration new`.
- **One logical change per file** — easier review and rollback reasoning.
- **RLS in same migration as table** — never expose a table without policies.
- **No Postgres enums** — use `text` + `CHECK` for extensibility.
- **Idempotent data fixes** — use `ON CONFLICT DO NOTHING` or conditional `UPDATE` (see scoring_rules bump migration).
- **`auth.uid()` wrapping** — `(select auth.uid())` in all policies.
- **Helper functions** — `SECURITY DEFINER` + `set search_path = public` when policies call functions that read other tables.

## Local vs prod workflow

1. Author migration locally.
2. `npm run db:reset` — verify clean apply.
3. `npm run types:gen` — update TypeScript types.
4. Commit migration + types + any dependent app code.
5. After merge, run `npm run db:push` against linked prod **before or with** deploy (coordinate timing).

Migrations are **not** run in Vercel CI. Manual push only.

## Seed

`supabase/config.toml` → `[db.seed]` → `sql_paths = ["./seed.sql"]`. Runs after migrations on `db:reset`. Tournament master data is loaded separately via `npm run wc2026:upload`.

## Rollback

No automated down migrations. Roll forward with a corrective migration. For local-only mistakes, `db:reset` is the clean slate.

## Type generation

```bash
npm run types:gen
# equivalent: supabase gen types typescript --local | grep -v '^Connecting to db' > src/lib/supabase/database.types.ts
```

Regenerate after every schema change. File is ESLint-ignored (auto-generated).
