> Context: [`context/data/seeding-and-master-data.md`](../../../context/data/seeding-and-master-data.md)

# Seed Scripts (wc_2026)

TypeScript upload tooling that loads committed JSON into Supabase with idempotent upserts.

## Module map

```
scripts/wc2026/
  upload.ts           entry: JSON → Supabase (npm run wc2026:upload)
  gen-fixtures.ts     one-off generator for fixtures.json
  lib/paths.ts        absolute paths to seed JSON files

scripts/lib/          shared seeder helpers (also re-export app lib)
  env.ts              target detection, LAN URL rewrite, --confirm-prod guard
  supabase.ts         createScriptAdminClient (no server-only import)
  schemas.ts          TournamentSchema, TeamSchema; re-exports PythonMatchSchema
  catalogs.ts         re-exports STAGES, ROUNDS from src/lib/fixtures/catalogs.ts
  maps.ts             re-exports resolveStage/resolveRound + madridLocalToUtcIso
  format.ts           inverse maps for any DB→JSON tooling (used by retired wc2022 download)
  upserts.ts          per-table upsert functions
  log.ts              step/info/done/warn/fatal console helpers

src/lib/fixtures/
  catalogs.ts         STAGES (7) + ROUNDS (9) — source of truth
  pythonFormat.ts     PythonMatchSchema, fase/round maps

src/lib/dates/
  madridTime.ts       madridLocalToUtcIso (Intl-based CET/CEST)
```

There is **no** `wc2026:download` script. Fixture changes after seeding are made via admin UI or by editing seed JSON and re-uploading.

## npm script

```json
"wc2026:upload": "tsx --env-file=.env.local scripts/wc2026/upload.ts"
```

Requires env vars:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Service-role writes (bypasses RLS) |
| `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG` | App default (`wc_2026`); not read by upload directly — slug comes from `tournament.json` |

## Input files (`scripts/wc2026/lib/paths.ts`)

| File | Schema | Notes |
|------|--------|-------|
| `data/seeds/wc_2026/tournament.json` | `TournamentSchema` | Upsert on `slug` |
| `data/seeds/wc_2026/teams.json` | `TeamsSchema` (min 1; expect 48) | Upsert on `(tournament_id, external_id)` |
| `data/seeds/wc_2026/fixtures.json` | `PythonMatchesSchema` | Flat array; 104 rows for current calendar |

### `tournament.json` (current)

```json
{
  "slug": "wc_2026",
  "name": "Mundial Norteamérica 2026",
  "year": 2026,
  "status": "active",
  "is_test": true,
  "predictions_open_until": null,
  "group_qualifiers_per_group": 2
}
```

### `teams.json` row shape

```json
{
  "external_id": "wc2026_team_mex",
  "code": "MEX",
  "canonical_name": "México",
  "display_name": "México",
  "aliases": ["México", "MEX"],
  "group_code": "A"
}
```

`group_code` regex: `^[A-L]$`. Team matching at upload uses `display_name`, `canonical_name`, and all `aliases`.

## Upload sequence (`upload.ts`)

1. `detectTarget()` + `assertSafeTarget({ writes: true })`
2. Parse and validate the three JSON files with Zod
3. `createScriptAdminClient()`
4. Upsert in dependency order:
   - `upsertTournament`
   - `upsertScoringRulesV1` — inserts active v1 from `DEFAULT_SCORING_RULES_V1`
   - `upsertStages` — from `STAGES` constant (7 rows)
   - `upsertRounds` — from `ROUNDS` constant (9 rows)
   - `upsertTeams`
   - Build `teamsByName` map (display + canonical + aliases)
   - `upsertFixtures`

## Stage and round catalog

From `src/lib/fixtures/catalogs.ts`:

**Stages:** `group_stage`, `round_of_32`, `round_of_16`, `quarter_final`, `semi_final`, `third_place`, `final`

**Rounds:** `group_md1`–`group_md3`, `r32`, `r16`, `qf`, `sf`, `third`, `final`

`score_multiplier` on stages mirrors scoring rules v1 (informational; authoritative scoring is `scoring_rules.rules` JSON).

## Fixture upsert logic (`upserts.ts`)

For each match in `fixtures.json`:

1. **Team resolution** — `"TBD"` on a side → `home_placeholder` / `away_placeholder`, `team_id` null. Otherwise lookup in `teamsByName`; skip match with warning if unknown name.
2. **Stage/round** — `resolveStage(fase)`, `resolveRound(fase, jornada)` from `pythonFormat.ts`
3. **Kickoff** — `madridLocalToUtcIso(fecha)` → UTC `timestamptz`
4. **Defaults** — `venue: null`, `status: "scheduled"`
5. **Upsert** on `(tournament_id, external_id)`

Skipped matches are logged but do not abort the run (typical when JSON has unresolved team names).

## `gen-fixtures.ts`

Regenerates `data/seeds/wc_2026/fixtures.json` from an in-file manifest:

- `GROUPS` — 48 teams in 12 groups (display names)
- `CODES` — lowercase FIFA slugs for `external_id` segments
- `MATCHDAYS` — FIFA template: J1 (1-2, 3-4), J2 (1-3, 4-2), J3 (4-1, 2-3)
- `GROUP_DATE` — shared kickoff per jornada (18:00 Madrid)
- `knockoutTemplate` — 32 placeholder knockouts with `"TBD"` teams

Run manually:

```bash
tsx scripts/wc2026/gen-fixtures.ts
```

Output: 72 group + 32 knockout = **104 fixtures**. Commit the JSON before upload.

`external_id` pattern examples:

- Group: `wc2026_md1_a_mex_rsa`
- Knockout: `wc2026_r32_01`, `wc2026_r16_03`, `wc2026_final_01` (final uses slug `final`, one row)

## Environment safety (`env.ts`)

- Parses `NEXT_PUBLIC_SUPABASE_URL`
- Rewrites `127.0.0.1` / `localhost` → `192.168.0.112` for tsx (Supabase CLI Docker binds LAN IP on macOS)
- **Writes to non-local URLs blocked** unless `--confirm-prod` is passed
- Prints warning banner when targeting production

Production example:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SECRET_KEY=<secret> \
  npx tsx scripts/wc2026/upload.ts --confirm-prod
```

## Script admin client (`supabase.ts`)

Separate from `src/lib/supabase/admin.ts` to avoid importing `"server-only"` in tsx. Same pattern: `createClient<Database>(url, SUPABASE_SECRET_KEY)`.

## Expected output

After successful local upload:

```
→ Loading JSONs
  tournament: wc_2026
  teams: 48
  matches: 104
→ tournament    ✓ tournament wc_2026
→ scoring_rules ✓ scoring_rules v1 active
→ stages        ✓ stages (7)
→ rounds        ✓ rounds (9)
→ teams         ✓ teams (48)
→ fixtures      ✓ fixtures (104)
→ Done
```

Fixture breakdown by `fase`: `fase_grupos` 72, `dieciseisavos` 16, `octavos` 8, `cuartos` 4, `semis` 2, `tercer_puesto` 1, `final` 1.

## Idempotency

Re-run `npm run wc2026:upload` after schema reset or to apply JSON changes. Upserts overwrite on conflict; counts should stay stable unless JSON changed.

**Caution:** Re-uploading stale JSON after admin UI edits can overwrite fixture fields keyed by `external_id`. There is no download step — merge admin changes into seed JSON manually or re-import via admin.

## SQL verification

```sql
select slug from tournaments where slug = 'wc_2026';
select count(*) from teams where tournament_id = (select id from tournaments where slug = 'wc_2026');
-- expect 48

select s.code, count(f.id)
from fixtures f
join stages s on s.id = f.stage_id
where f.tournament_id = (select id from tournaments where slug = 'wc_2026')
group by s.code order by s.code;
-- group_stage 72, round_of_32 16, round_of_16 8, ...

select count(*) from fixtures
where tournament_id = (select id from tournaments where slug = 'wc_2026');
-- expect 104

select count(*) from scoring_rules
where tournament_id = (select id from tournaments where slug = 'wc_2026') and active = true;
-- expect 1
```

## Tables touched

| Table | Operation |
|-------|-----------|
| `tournaments` | upsert on `slug` |
| `scoring_rules` | upsert v1, `active: true` |
| `stages` | upsert on `(tournament_id, code)` |
| `rounds` | upsert on `(tournament_id, code)` |
| `teams` | upsert on `(tournament_id, external_id)` |
| `fixtures` | upsert on `(tournament_id, external_id)` |

Not touched: `match_results`, `match_predictions`, `profiles`, `players`, user data.

## Integration with admin import

`PythonMatchSchema` is identical for seed JSON and `/admin/fixtures/import`. Admin import adds `ImportFixturesSchema` max 64 rows per paste; the seeder accepts any array length.

Team name resolution in admin import mirrors upload (display, canonical, aliases, placeholder detection). See `documentation/services/web/fixtures-admin.md`.

## Related

- Overview: `context/data/seeding-and-master-data.md`
- Python tooling: `documentation/services/data-tooling/python-pipeline.md`
- Local dev: `context/04-local-development.md`
- Retired 2022 scripts: `documentation/deprecated/wc2022-seed-and-sync.md`
