> Context: [`context/web/fixtures-admin.md`](../../../context/web/fixtures-admin.md)

# Fixtures Admin — implementation detail

Routes, server actions, import resolver, schemas, timezone helpers, and SQL touched.

## Module map

```
src/app/admin/fixtures/
  page.tsx              list + filters + status counters
  [id]/page.tsx         edit form (server component + native form action)
  new/page.tsx          single-fixture create
  import/
    page.tsx            import shell + format hint
    ImportClient.tsx    client: textarea, preview (useActionState), commit
  actions.ts            updateFixture, createFixture, previewImport, commitImport
  schemas.ts            Update/Create payload Zod + FormData readers
  _import.ts            parseImportPayload, resolveImport, buildTeamLookup (pure)

src/lib/fixtures/
  catalogs.ts           STAGES, ROUNDS constants
  pythonFormat.ts       PythonMatchSchema, fase/round/stage maps

src/lib/dates/
  madridTime.ts           Madrid ↔ UTC conversion + display formatting

src/lib/tournament/
  getDefaultTournament.ts  resolves wc_2026 from env slug

scripts/lib/
  catalogs.ts, schemas.ts, maps.ts, format.ts  re-exports from src/lib/fixtures + madridTime
```

## Authorization

- `src/proxy.ts`: `/admin/*` requires session + `profiles.role = 'admin'`
- Every page/action calls `requireAdmin()` (defence in depth)
- Supabase: policy `fixtures_admin_all` on `fixtures` for authenticated admins

No service-role client in this module.

## List page (`/admin/fixtures`)

**Query** — fixtures with joins:

```ts
.select(`
  id, external_id, kickoff_at, status, group_code, venue,
  home_placeholder, away_placeholder,
  home_team:teams!fixtures_home_team_id_fkey ( id, code, display_name ),
  away_team:teams!fixtures_away_team_id_fkey ( id, code, display_name ),
  stage:stages ( id, code, name, sort_order ),
  round:rounds ( id, code, name, sort_order )
`)
.eq("tournament_id", tournament.id)
.order("kickoff_at")
```

**Filters** (`searchParams`, GET form):

- `round` — code from `ROUNDS` in `catalogs.ts`; resolved to `round_id` before filter
- `status` — `scheduled | locked | completed | cancelled`

**Counters** (second query, unfiltered): total + per-status counts + `lockedByKickoff`.

`lockedByKickoff` uses `Date.now() >= kickoff_at - 24h`. This is **legacy** and unrelated to `is_fixture_locked()` / manual round lock. Do not use it for prediction-lock diagnostics.

Uses `await connection()` before `Date.now()` (Next.js 16 dynamic render).

**Success banners**: `?ok=created|updated|imported:<summary>`

## Edit page (`/admin/fixtures/[id]`)

Loads fixture + teams list. Read-only display: `external_id`, stage, round, group, UUID.

Editable via `<form action={updateFixture}>`:

- `kickoff_at` — `datetime-local`, default from `utcIsoToMadridInput`
- `home_team_id` / `home_placeholder`, `away_team_id` / `away_placeholder`
- `venue`, `status`

Warnings:

- Round locked (`round.predictions_locked_at IS NOT NULL`) — points admin to `/admin/results` to unlock
- `status` in `completed` | `cancelled`

## Create page (`/admin/fixtures/new`)

Fields: `external_id`, `stage_id`, `round_id`, optional `group_code` (A–L), home/away sides, kickoff, venue, status (default `scheduled`).

Suggested `external_id` pattern: `wc2026_<round>_NNN` where round ∈ `{ r32, r16, qf, sf, third, final }`.

Server validates:

- `round.stage_id === stage_id` and both belong to tournament
- `(tournament_id, external_id)` unique
- home ≠ away when both are real teams

Redirect on success: `/admin/fixtures/[new_id]?ok=created`

## Server actions (`actions.ts`)

### `updateFixture(formData)`

1. `readUpdatePayload` → Zod
2. Reject same team both sides
3. `madridLocalToUtcIso(kickoff_at)`
4. `supabase.from("fixtures").update(...).eq("id").eq("tournament_id")`
5. `revalidatePath` + redirect `?ok=updated`

### `createFixture(formData)`

Same flow with create schema + round/stage/uniqueness checks + `insert`.

### `previewImport` / `commitImport`

`previewImport` — `useActionState` handler; returns `PreviewState` with `ResolveReport`, no DB writes.

`commitImport`:

1. Re-parses JSON and re-runs `resolveImport` (does not trust client preview)
2. Aborts if any `kind: "error"`
3. `upsert(rows, { onConflict: "tournament_id,external_id" })`
4. Redirect `/admin/fixtures?ok=imported:…`

`buildImportCtx()` loads stages, rounds, teams, existing `external_id` set into `ResolveCtx`.

## Import resolver (`_import.ts`)

### `parseImportPayload(raw)`

`JSON.parse` → `ImportFixturesSchema` (1–64 rows cap for UI).

### `resolveSide(name)`

1. Match `teamsByNormalisedName` (display, canonical, aliases — case-insensitive trim)
2. Else if `looksLikePlaceholder(name)` → `{ placeholder: name }`
3. Else error

Placeholder heuristics: starts with digit, contains `grupo`/`group`, starts with known prefix (`ganador`, `perdedor`, `tbd`, …), or starts with `?`.

Literal `"TBD"` in JSON maps to placeholder (see `pythonFormat.ts` comment).

### Per-row resolution

- `resolveStage(fase)` + `resolveRound(fase, jornada)` → UUIDs from ctx maps
- `madridLocalToUtcIso(fecha)`
- `kind`: `update` if `external_id ∈ existingExternalIds`, else `create`
- Upsert row always sets `status: "scheduled"` (import does not preserve prior status on update)

## Zod schemas

### Form payloads (`schemas.ts`)

- `FixtureStatusSchema` — four status values
- `SidePayloadSchema` — team_id OR placeholder; `readSide` nulls placeholder when team_id present
- `CreateFixturePayloadSchema` — `group_code` regex `^[A-L]$`
- `UpdateFixturePayloadSchema` — id + editable fields

### Python JSON (`pythonFormat.ts`)

```ts
PythonMatchSchema = {
  external_id,           // snake_case
  fase,                  // fase_grupos | dieciseisavos | octavos | cuartos | semis | tercer_puesto | final
  tipo_partido,          // grupo | eliminatoria | null
  jornada,               // 1|2|3 for groups, null for knockouts
  grupo,                 // A–L | null
  equipo_1, equipo_2,
  fecha,                 // Madrid local ISO without TZ
  venue?,                // optional
  marcador_*, prorroga, penaltis, ganador  // optional, ignored by import
}
```

`ImportFixturesSchema` = array min 1 max 64.

### Fase → stage/round maps

| `fase` | `stage.code` | `round.code` |
|--------|--------------|--------------|
| `fase_grupos` + jornada 1–3 | `group_stage` | `group_md1`–`group_md3` |
| `dieciseisavos` | `round_of_32` | `r32` |
| `octavos` | `round_of_16` | `r16` |
| `cuartos` | `quarter_final` | `qf` |
| `semis` | `semi_final` | `sf` |
| `tercer_puesto` | `third_place` | `third` |
| `final` | `final` | `final` |

Inverse helpers: `stageToFase`, `roundToJornada`, `tipoPartidoFromFase` — used by download/upload scripts.

## Madrid time (`madridTime.ts`)

| Function | Purpose |
|----------|---------|
| `madridLocalToUtcIso(input)` | Form/import local string → UTC ISO. Iterates offset once for DST edges |
| `utcIsoToMadridInput(utc)` | UTC → `YYYY-MM-DDTHH:MM` for `datetime-local` |
| `utcIsoToMadridLocal(utc)` | UTC → `YYYY-MM-DD HH:MM:SS` for Python export |
| `formatMadridDateTime(utc)` | Human label for tables |

Uses `Intl.DateTimeFormat` with `timeZone: "Europe/Madrid"` — not the old hardcoded `+02:00` from early seed scripts.

## Catalogs (`catalogs.ts`)

Seven stages (group ×1 mult through final ×5 mult on `score_multiplier` column — informational; scoring truth is `scoring_rules`).

Nine rounds: `group_md1`–`group_md3`, `r32`, `r16`, `qf`, `sf`, `third`, `final`.

## Import UI (`ImportClient.tsx`)

Client component with `useActionState(previewImport)`.

- Textarea `name="payload"`
- Preview table: KindBadge (nuevo / actualiza / error)
- Commit button uses `formAction={commitImport}`; disabled unless preview has zero errors and at least one row

Commit re-validates server-side — client cannot skip preview errors.

## SQL tables touched

| Table | Operations |
|-------|------------|
| `fixtures` | SELECT (list/edit), INSERT (create), UPDATE (edit), UPSERT (import) |
| `teams` | SELECT (name resolution, form dropdowns) |
| `stages` | SELECT (create form, import ctx) |
| `rounds` | SELECT (filters, create validation, import ctx, edit lock banner) |
| `tournaments` | SELECT via `getDefaultTournament()` |

Constraints relied on:

- `(tournament_id, external_id)` unique
- `(home_team_id IS NOT NULL OR home_placeholder IS NOT NULL)` per side
- FKs to tournament, stage, round, teams

## Out of scope (by design)

- Delete fixture from UI
- Edit `external_id`, stage, round after create (change via re-import with same `external_id`)
- Web CRUD for `teams`, `stages`, `rounds`, `tournaments`
- Player management
- Writing `match_results` from import (result keys ignored)

## Verification

```bash
npm run dev
# Admin: /admin/fixtures — list loads
# Edit kickoff → persists on reload
# Import: paste sample from documentation/implementations/admin-fixtures-json-import.md
# Re-import same JSON → preview shows "actualiza", no duplicates

npm run typecheck && npm run lint
```

Cross-check timezone: `18:00 Madrid` in June → `16:00Z` (CEST).

## Related docs

- JSON import prompt: `documentation/implementations/admin-fixtures-json-import.md`
- Seeding pipeline: `documentation/services/data-tooling/seed-scripts.md` (Phase 2)
- Results entry (round lock): `documentation/services/web/results-entry.md`
- `fixtures` table: `documentation/services/database/tables.md`
