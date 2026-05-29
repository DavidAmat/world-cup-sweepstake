# Admin Reset & Scoring Rules

Two destructive/maintenance admin tools: wipe tournament **player data** for testing, and version **scoring rules** with optional full recalculation.

## What it is

### `/admin/reset` — selective data wipe

Lets the admin delete rows from chosen tables for the **default tournament** (`wc_2026` via `getDefaultTournament()`). Used to clear test predictions, results, and scores before the real tournament — not for editing master data.

Checkboxes map to one or more tables. Confirmation requires typing **`BORRAR`** exactly (client disables submit until then; server action verifies again).

**Never touched:** `tournaments`, `teams`, `fixtures`, `stages`, `rounds`, `scoring_rules`, `profiles`, `app_settings`, `rounds.predictions_locked_at`, `terms_acceptances`, `player_match_stats`.

Deletes use the **service-role client** (`createAdminClient`) so all users' rows can be removed regardless of RLS.

### `/admin/reglas` — scoring rules versioning

Manages `scoring_rules` rows per tournament: duplicate → edit draft → activate → recalculate.

The app runs **one tournament with one fixed rules set** in practice (`DEFAULT_SCORING_RULES_V1` / seeded v1). The UI exists for flexibility and testing; changing live rules mid-tournament is not part of the product plan.

Workflow:

1. **Duplicar y editar** — copies JSON from any version, inserts new row with `version + 1`, `active = false`, opens editor
2. **Editar borrador** — numeric form for all `ScoringRulesV1` fields (drafts only)
3. **Guardar borrador** — persists JSON on inactive row
4. **Activar esta versión** — sets all other rows `active = false`, then target `active = true` (two updates, not a DB transaction)
5. **Recalcular ahora** — on the **active** version only; calls `recalculateTournamentScores()` (full delete + reinsert of `prediction_scores`)

Activation does **not** auto-recalculate — the banner tells the admin to run recalc after activating.

## Authorization

- `proxy.ts` gates `/admin/*` (session + `role = admin`)
- Pages call `requireAdmin()`; every server action calls it again
- Reset and reglas **writes** use `createAdminClient()` (bypass RLS)

## Revalidation after reset / recalc

Both flows revalidate leaderboards, predictions, and related admin paths so cached server components refresh.

## Product vs infrastructure

| Feature | Product use | Infrastructure |
|---------|-------------|----------------|
| Reset | Clear local/staging test data | Checkbox granularity, FK-safe order |
| Rules UI | Unlikely to change v1 in production | Versioning + activate + manual recalc |
| Recalc elsewhere | Automatic on confirm result, save predictions, evaluaciones | Same `recalculateTournamentScores` core |

See `context/web/scoring-engine.md` for when recalculation runs outside `/admin/reglas`.

## Where to look deeper

- Implementation: `documentation/services/web/admin-reset-and-rules.md`
- Scoring engine (consumes active rules): `context/web/scoring-engine.md`
- Database: `documentation/services/database/tables.md` (`scoring_rules`, deletable tables)
- Admin hub: `/admin` links to both pages
