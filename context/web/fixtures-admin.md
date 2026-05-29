# Fixtures Admin

Admin UI to view, edit, create, and bulk-import `fixtures` for the active tournament (`wc_2026`). Group-stage matches are seeded by `scripts/wc2026/upload.ts`; knockout rounds are added through JSON import.

## What it is

Fixtures are the schedule rows players predict against. Each row links to a `stage`, `round`, optional `group_code`, home/away team (or Spanish placeholder text), `kickoff_at` (UTC in DB, Madrid in UI), and `status`.

The admin manages fixtures without touching SQL:

1. **List** (`/admin/fixtures`) — filterable table of all fixtures
2. **Edit** (`/admin/fixtures/[id]`) — update kickoff, teams/placeholders, venue, status
3. **Create one** (`/admin/fixtures/new`) — manual fallback for a single fixture
4. **Bulk import** (`/admin/fixtures/import`) — paste JSON array; preview then upsert (preferred for knockouts)

All routes require admin (`proxy.ts` gate + `requireAdmin()`). Writes use the **server user client** — RLS policy `fixtures_admin_all` grants admins full access.

## Key rules

| Rule | Behaviour |
|------|-----------|
| `external_id` | Set at create/import; **read-only** on edit. Stable anchor for JSON ↔ DB round-trip |
| Delete | **Not supported** from UI (admin reset in `/admin/reset` can wipe data) |
| Team vs placeholder | Each side needs `team_id` **or** `placeholder` (DB CHECK). Form prefers team when both sent |
| Same team both sides | Rejected on create, update, and import |
| Tournament | Hardcoded via `getDefaultTournament()` → `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG` (`wc_2026`) |
| Prediction lock | **Not** controlled by `fixtures.status`. Admin locks whole jornadas at `/admin/results` (`rounds.predictions_locked_at`) |

`fixtures.status` (`scheduled` | `locked` | `completed` | `cancelled`) is manual metadata. Result confirmation in `/admin/results` normally drives `completed`; the admin can override with a warning.

## Bulk JSON import (primary path for knockouts)

Workflow:

1. Copy match list from an official source (FIFA, etc.)
2. Paste into ChatGPT with the prompt in `documentation/implementations/admin-fixtures-json-import.md`
3. Copy the returned JSON array into `/admin/fixtures/import`
4. **Validar y previsualizar** → green (create), amber (update by `external_id`), red (errors block commit)
5. **Confirmar e insertar** → upsert on `(tournament_id, external_id)`

Schema is shared with the seed pipeline (`PythonMatchSchema` in `src/lib/fixtures/pythonFormat.ts`). Result fields in JSON are ignored.

Team names resolve against `teams.display_name`, `canonical_name`, or `aliases`. Unresolved names that look like placeholders (`Ganador A`, `2.º Grupo C`, `TBD`, …) become `home_placeholder` / `away_placeholder`.

## Timezone

- DB stores `kickoff_at` as UTC `timestamptz`
- Admin forms use `<input type="datetime-local">` in **Europe/Madrid** wall time
- Conversion via `madridLocalToUtcIso` / `utcIsoToMadridInput` (`src/lib/dates/madridTime.ts`) using `Intl` (CET/CEST automatic, no hardcoded +02:00)

Display tables use `formatMadridDateTime` (e.g. `29-Jun 16h00`).

## Shared lib (also used by seed scripts)

- `src/lib/fixtures/catalogs.ts` — `STAGES`, `ROUNDS` (groups A–L, R32, R16, …)
- `src/lib/fixtures/pythonFormat.ts` — Zod schema, `fase` → stage/round maps
- `scripts/lib/*` — thin re-exports from the above + `madridTime` for `scripts/wc2026/upload.ts`

Group fixtures (~72 matches) load from seed JSON via upload script; knockouts are added incrementally as the bracket is known.

## Stale UI note

The list page header still shows **"X bloqueados ahora"** counting fixtures within 24h of kickoff. That metric predates manual jornada locking and does **not** reflect `is_fixture_locked()`. Actual prediction lock is per `rounds.predictions_locked_at` — see `context/web/match-predictions.md`.

## Where to look deeper

- Implementation: `documentation/services/web/fixtures-admin.md`
- JSON import prompt (copy-paste for ChatGPT): `documentation/implementations/admin-fixtures-json-import.md`
- Master data seeding: `context/data/seeding-and-master-data.md` (Phase 2)
- Results + round lock: `context/web/results-entry.md`
- Madrid time helpers (shared): `context/shared/dates-and-timezone.md`
