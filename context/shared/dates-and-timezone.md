# Dates & Timezone

How the app stores instants, displays Madrid wall time, and optionally overrides "now" for testing.

## Storage rule

**Database:** all `timestamptz` columns (e.g. `fixtures.kickoff_at`, lock timestamps) are **UTC**.

**Human-facing UI:** Spanish users think in **Europe/Madrid** (CET/CEST). Admin datetime inputs and table labels convert at the edge — never hardcode `+02:00`.

## Madrid helpers (`src/lib/dates/madridTime.ts`)

Uses `Intl.DateTimeFormat` with `timeZone: "Europe/Madrid"` so DST transitions are correct (no fixed offset).

| Function | Direction | Use |
|----------|-----------|-----|
| `madridLocalToUtcIso(input)` | Madrid wall → UTC ISO | Seed upload, admin fixture forms, `FECHA_ACTUAL` date-only values |
| `utcIsoToMadridLocal(utcIso)` | UTC → `"YYYY-MM-DD HH:MM:SS"` Madrid | Python pipeline / JSON export shape |
| `utcIsoToMadridInput(utcIso)` | UTC → `"YYYY-MM-DDTHH:MM"` | `<input type="datetime-local">` |
| `formatMadridDateTime(utcIso)` | UTC → `"29-May 18h00"` | Tables, badges |

Accepted Madrid-local input patterns: `YYYY-MM-DD HH:MM:SS`, `YYYY-MM-DD HH:MM`, or `T` separator.

Shared by:

- Admin fixtures (`context/web/fixtures-admin.md`)
- Seed scripts (`scripts/lib/maps.ts` re-exports)
- `parseFechaActual` in `appNow.ts`

## Simulated "now" (`FECHA_ACTUAL` + `app_now()`)

Optional dev/testing knob. **Does not auto-lock predictions** — all locks are admin-controlled (see `context/shared/prediction-locking.md`).

### Why it lives in the database

RLS and Server Actions must agree on "now". If only the app faked time, Postgres policies would still use real `now()` and behaviour would diverge. The override is stored in **`app_settings.fecha_actual`** (single row, `id = true`) and read by **`public.app_now()`**:

```sql
select coalesce(
  (select fecha_actual from app_settings where id),
  now()
)
```

### App sync (`src/lib/dates/appNow.ts`)

On pages that call `getMatchLockState`, the app runs `syncAppNowFromEnv()`:

1. Parses `process.env.FECHA_ACTUAL` via `parseFechaActual`
2. Writes to `app_settings.fecha_actual` with the **admin client** (only when value changed)
3. Never throws — sync failure logs a warning and the page continues

**Accepted `FECHA_ACTUAL` formats:**

| Input | Effect |
|-------|--------|
| unset / empty | No override (`fecha_actual = NULL` → real `now()`) |
| `YYYY-MM-DD` | That day **00:00 Madrid** → UTC |
| `YYYY-MM-DDTHH:MM` or `YYYY-MM-DD HH:MM:SS` | That Madrid wall time → UTC |
| Full ISO with `Z` or offset | Used as-is |

Invalid values log a warning and are ignored (falls back to real now).

### Local setup

Add to `.env.local` and **restart the dev server**:

```bash
FECHA_ACTUAL=2026-06-15
# or
FECHA_ACTUAL=2026-06-15T14:30
```

There is no Makefile helper. Clear the var (or leave empty) to return to real time.

### What still uses `app_now()`

- `getMatchLockState` RPC call — exposes `appNow` in `MatchLockState` (for potential debug UI; not currently rendered)
- Any future feature that compares against simulated now in SQL

### What does **not** use `app_now()` anymore

After migrations `20260525120000` (match) and `20260527120000` (initial):

- `is_fixture_locked()` — reads `rounds.predictions_locked_at` only
- `are_initial_predictions_locked()` — reads `tournaments.initial_predictions_locked_at` only

The old 24h-before-kickoff and kickoff-based initial lock paths were removed.

## Fixture kickoffs in seed JSON

Python/seed JSON stores `fecha` as Madrid local strings (e.g. `"2026-05-29 18:00:00"`). Upload converts once to UTC before insert.

## Where to look deeper

- SQL function: `documentation/services/database/functions.md` (`app_now`)
- `app_settings` table: `documentation/services/database/tables.md`
- Fixtures admin timezone UX: `documentation/services/web/fixtures-admin.md`
- Prediction locking (orthogonal to FECHA_ACTUAL): `context/shared/prediction-locking.md`
