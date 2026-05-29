> Context: [`context/web/admin-reset-and-rules.md`](../../../context/web/admin-reset-and-rules.md)

# Admin Reset & Scoring Rules — implementation detail

Routes, server actions, modal UX, rules editor fields, delete order, and SQL touched.

## Module map

```
src/app/admin/reset/
  page.tsx          server: banner, warning, ResetModal
  ResetModal.tsx    client: checkboxes, modal, BORRAR gate, form submit
  actions.ts        resetTournamentData

src/app/admin/reglas/
  page.tsx          server: version list, action buttons, inline editor
  RulesEditor.tsx   client: numeric form → saveScoringRulesDraft
  actions.ts        duplicateScoringRules, saveScoringRulesDraft,
                    activateScoringRules, recalculateScoringRules

src/lib/scoring/
  recalculate.ts              recalculateTournamentScores (admin client wrapper)
  recalculateCore.ts          orchestrator (used by reglas + results + …)
  rules.ts                    DEFAULT_SCORING_RULES_V1 fallback
  types.ts                    ScoringRulesV1 shape

src/lib/supabase/admin.ts     createAdminClient (service role)
```

## Authorization pattern

| Layer | Mechanism |
|-------|-----------|
| Route access | `src/proxy.ts` — `/admin/*` requires admin profile |
| Page | `await requireAdmin()` |
| Actions | `await requireAdmin()` then `createAdminClient()` for mutations |

Reset/reglas need the admin client because deletes and bulk rule updates span all users' rows.

---

## `/admin/reset`

### Page (`page.tsx`)

- Loads `getDefaultTournament()` — **no tournament dropdown** (single-tournament app)
- Passes `tournamentId` + `tournamentName` to `ResetModal`
- Banners: `?ok=reset`, `?error=` (URL-encoded Spanish messages)

### ResetModal (`ResetModal.tsx`)

Client state:

- `selected: Set<string>` — checkbox keys
- `open` — modal visibility
- `confirmText` — must equal `BORRAR` for submit

Six checkbox options (`TABLES` constant):

| Checkbox `value` | DB tables deleted |
|------------------|-------------------|
| `initial_predictions` | `initial_predictions` |
| `match_predictions` | `match_predictions` |
| `group_qualification_predictions` | `group_qualification_predictions` |
| `match_results` | `match_goals`, then `match_results` |
| `prediction_scores` | `prediction_scores` |
| `leaderboard_snapshots` | `leaderboard_snapshots` |

UI helpers: Seleccionar todo / Deseleccionar todo. Modal lists selected labels before confirm.

Form posts to `resetTournamentData` with hidden fields: `tournament_id`, `confirm`, `tables[]` per selection.

Modal uses fixed overlay (`z-50`), not `createPortal` — sufficient on this page.

### `resetTournamentData(formData)`

```ts
await requireAdmin();
const supabase = createAdminClient();
// confirm === "BORRAR", tournament_id required, tables[] non-empty
// Map checkbox values → physical tables via TABLE_MAP
// Delete in DELETE_ORDER (FK-safe)
```

**Delete order** (always this sequence when table is selected):

1. `prediction_scores`
2. `leaderboard_snapshots`
3. `match_goals`
4. `match_results`
5. `match_predictions`
6. `initial_predictions`
7. `group_qualification_predictions`

Each: `.delete().eq("tournament_id", tournamentId)`.

**Revalidate:** `/clasificacion` layout, `/my-scores`, `/predictions` layout, `/admin/results`, `/admin/reset`.

Redirect: `/admin/reset?ok=reset`.

### Not deleted

Master data and config: `fixtures`, `teams`, `stages`, `rounds`, `tournaments`, `scoring_rules`, `profiles`, `app_settings`, `terms_acceptances`, `player_match_stats`.

Round lock timestamps (`rounds.predictions_locked_at`) persist — reset does not reopen jornadas.

---

## `/admin/reglas`

### Page (`page.tsx`)

Loads all `scoring_rules` for default tournament via admin client:

```ts
.select("id, version, active, rules, created_at")
.order("version", { ascending: false })
```

Query params:

- `?editing={ruleId}` — expands `RulesEditor` for that draft
- `?ok=saved|activated|recalculated`
- `?error=`

Per version card:

| Control | Visible when | Action |
|---------|--------------|--------|
| Duplicar y editar | always | `duplicateScoringRules` |
| Editar borrador / Cerrar editor | `active = false` | toggle `?editing=` link |
| Activar esta versión | `active = false` | `activateScoringRules` |
| Recalcular ahora | `active = true` | `recalculateScoringRules` |

Rules JSON fallback: `DEFAULT_SCORING_RULES_V1` if null.

Created date shown with `formatMadridDateTime`.

### RulesEditor (`RulesEditor.tsx`)

Client form `action={saveScoringRulesDraft}`. Hidden `rule_id`.

Sections and form field names (mapped in `parseRulesFromFormData`):

**Partido (90')**

- `correct_outcome_90`, `exact_score_90`
- `home_goals_distance_0|1|2`, `away_goals_distance_0|1|2`
- `goal_difference_exact`

**Eliminatorias**

- `correct_extra_time`, `correct_penalties`, `correct_qualified_team`

**Multiplicadores por fase**

- `mult_group_stage`, `mult_round_of_32`, `mult_round_of_16`, `mult_quarter_final`, `mult_semi_final`, `mult_third_place`, `mult_final`

**Predicciones iniciales**

- `init_champion`, `init_runner_up`, `init_top_scorer`, `init_best_player`

**Clasificados de grupo**

- `gq_team_correct`

Uses shared `NumberInput` component (`max={9999}`, required). No client-side Zod — server parses with `Number(formData.get(...))`.

### Server actions (`reglas/actions.ts`)

#### `duplicateScoringRules`

1. Load source row (`tournament_id`, `rules`, `version`)
2. `newVersion = max(existing version) + 1`
3. Insert `{ active: false, rules: copy }`
4. Redirect `/admin/reglas?editing={newId}`

#### `saveScoringRulesDraft`

1. Reject if target row `active = true`
2. `parseRulesFromFormData` → `ScoringRulesV1`
3. Update `rules` JSON where `id = ruleId AND active = false`
4. Redirect `?ok=saved&editing={ruleId}`

#### `activateScoringRules`

1. Load `tournament_id` for rule
2. `UPDATE scoring_rules SET active = false WHERE tournament_id = ? AND id != ?`
3. `UPDATE scoring_rules SET active = true WHERE id = ?`

Not transactional — if step 3 fails, tournament may temporarily have no active row. Engine falls back to `DEFAULT_SCORING_RULES_V1` in `recalculateCore.ts` when no active row.

Does **not** trigger recalculation.

#### `recalculateScoringRules`

1. `getDefaultTournament()`
2. `recalculateTournamentScores(tournament.id)` → admin client + `recalculateTournamentScoresCore`
3. Revalidate clasificacion layout, my-scores, reglas
4. Redirect `?ok=recalculated`

No `rule_id` parameter — always recalcs using whichever row is currently `active = true`.

---

## `ScoringRulesV1` and defaults

Shape in `src/lib/scoring/types.ts`. Stored in `scoring_rules.rules` JSONB.

Active defaults (`DEFAULT_SCORING_RULES_V1`):

| Area | Values |
|------|--------|
| Match 90' | outcome 5, exact 10, distance 3/2/1, diff 3 |
| Knockout extras | prórroga 5, penaltis 5, qualified 8 |
| Multipliers | groups ×1; R32/R16/QF/third ×2; SF ×3; final ×5 |
| Initial | champion 200, runner-up 150, pichichi/MVP 100 |
| Group qual | team_correct 25 |

DB constraint: partial unique index `scoring_rules_one_active_per_tournament` — at most one `active = true` per tournament.

Migration `20260528130000` updated live rows for group qual 25 (seed script + upload also set v1).

---

## Database

### `scoring_rules` columns

`id`, `tournament_id`, `version`, `active`, `rules` (JSONB), `created_at`, `updated_at`.

RLS: authenticated SELECT; admin ALL via `is_admin()`.

### Tables reset can touch

See checkbox map above. All filtered by `tournament_id`.

---

## Admin hub (`/admin/page.tsx`)

Cards link to `/admin/reset` and `/admin/reglas` alongside fixtures, results, evaluaciones.

---

## Verification

### Reset

```bash
# Local: note row counts, run reset with all boxes + BORRAR
# psql: counts for selected tables → 0 for tournament_id
# fixtures/teams/scoring_rules unchanged
```

### Reglas

```bash
# Duplicate active v1 → edit draft (e.g. correct_outcome_90 = 7)
# Activate draft → Recalcular ahora
# SQL: prediction_scores points change; scoring_rules_version on rows updates
npm run scoring:smoke  # alternative recalc entry point
```

Wrong confirm text → redirect `?error=La+confirmación+no+coincide`. Empty checkboxes → `?error=Selecciona+al+menos+una+tabla`.

---

## Related docs

- Scoring orchestrator: `documentation/services/web/scoring-engine.md`
- Manual recalc on jornada page: `documentation/services/web/leaderboards.md` (`recalculateClasificacion`)
- Results confirm trigger: `documentation/services/web/results-entry.md`
- RLS on scoring tables: `documentation/services/database/rls.md`

## Differences from hito-14 plan (code wins)

- No tournament dropdown on reset — always default tournament
- Pages **do** call `requireAdmin()` (not actions-only)
- `recalculateScoringRules` has no form parameters
- Rules editor has no client Zod — numeric inputs only
- Activate + recalc are separate explicit steps
