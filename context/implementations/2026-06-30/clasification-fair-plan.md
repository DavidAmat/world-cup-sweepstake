# Implementation Plan — "La Porra Justa" (Fair Classification)

> Status: **IMPLEMENTED** (2026-06-30). Migration `20260630120000_fair_clasification.sql` applied to **local + prod**; prod seeded (25 stoppage-time rows → 76 fair results, 1232 fair scores). Q1 (real-draw-stays-draw → keep real ET/pens/advancer) and Q2 (Case 2 shows fair winner as advancer) resolved per the user's answers below and verified against prod. Source brief: [`clasification-fair-prompt.md`](./clasification-fair-prompt.md). Late-goal data: [`fair_clasification.json`](./fair_clasification.json).
>
> **Where the code lives:** migration `supabase/migrations/20260630120000_fair_clasification.sql`; engine `src/lib/scoring/fair/` (`deriveFairResult`, `recalculateFairCore`, `recalculateFair`, `fairLeaderboard`); pages `src/app/(app)/porra-justa/`; admin input on `ResultForm.tsx` + `admin/results/actions.ts`; nav in `HeaderClient.tsx`; seed `scripts/wc2026/seed-fair-added-time.ts` (`npm run wc2026:fair-seed[:prod]`).

## Hard rules (non-negotiable)

1. **Never modify any existing table** or the data in it. No edits to `match_results`, `prediction_scores`, scoring rules, etc.
2. **Never change the real scoring/leaderboard logic or UI.** The real "Resultado Real" pipeline stays byte-for-byte identical.
3. Everything is **additive**: new tables, new pages, new server code. The only edits to existing files are *purely additive* (a nav dropdown, an extra input block on the admin result form, and an extra write call) and they never touch the real `match_results` write or the real recalc.
4. We are **mid-competition with real data** — no destructive operations on existing data.

The whole feature is a **parallel pipeline** that treats the *Resultado Justo* (real score minus stoppage-time "al 90" goals) as if it were the real result, reusing the exact same pure scoring functions.

---

## 1. Concept recap & the core derivation

For each match we may subtract goals scored **from the 90th minute onward in regulation stoppage time** (90+x), excluding extra time and penalties. The brief calls these *goles al 90*.

- **Real result** stays as is.
- **Resultado Justo** = real 90' score with the stoppage-time goals subtracted per team.
- Points are recomputed **as if the Resultado Justo were the real result**, using the same `scoring_rules` and the same scorer functions.
- **Predicciones Iniciales** (campeón, subcampeón, pichichi, mejor jugador) and **Clasificados de grupo** are **NOT** recomputed — they are copied verbatim from the real scores (brief §"Clasificados de Grupo").

### 1.1 Group stage (`tipo_partido = grupo` / `fase_grupos`)

Trivial: `fair_home = home_90 − home_added`, `fair_away = away_90 − away_added`. No qualifier, no ET, no penalties. Score with `scoreGroupMatch`.

### 1.2 Knockout (`tipo_partido = eliminatoria`)

Let `fh`, `fa` be the fair 90' goals. The real result row tells us who really advanced (`qualified_team_id`).

```
if fh != fa:                     # Resultado Justo has a 90' winner
    fairWinner   = side with more fair goals
    went_extra_time = false
    went_penalties  = false
    qualified_team  = fairWinner          # may differ from the real advancer
elif fh == fa:                   # Resultado Justo is a draw  → counterfactual extra time
    went_extra_time = true
    went_penalties  = false               # counterfactual ET → we never reward penaltis
    qualified_team  = real qualified_team_id   # the team that really advanced still advances
```

This single rule reproduces both worked cases in the brief:

- **Case 1 (goal broke a tie):** real `1‑0` (late winner) → fair `0‑0` draw → `went_extra_time = true`, the real winner still advances. Users who predicted **prórroga** get `correct_extra_time`; users who predicted that team advancing get `correct_qualified_team`; the `0‑0` is scored as the base. Penaltis are **not** rewarded.
- **Case 2 (goal forced a prórroga):** real `1‑1` that really went to penalties (late equalizer) → fair `1‑0` → fair winner advances in regulation, `went_extra_time = false`, `went_penalties = false`. Nobody gets ET/penalti points, and the fair qualifier is the **fair 90' winner** (which may not be the real penalty winner).

The breakdown then follows naturally from the existing `scoreKnockoutMatch`:
- `correct_extra_time` only when `went_extra_time && predicts_extra_time`,
- `correct_penalties` only when `went_penalties && predicts_penalties` (always false in fair world),
- `correct_qualified_team` only when the user's pick equals the fair `qualified_team`.

> **Edge note (rare, not in current data):** a real draw that stayed a draw after subtraction (both teams scored in stoppage time, net still level) would be a counterfactual-ET-or-not ambiguity. None exists in `fair_clasification.json`. Default decision: treat any fair draw in a knockout as counterfactual ET with **prórroga-only** rewards (penaltis excluded). See Open Questions Q1.

This logic lives in one new pure function `deriveFairResult(real, added, isKnockout)` (mirrors the shape of `deriveResult` in `src/app/admin/results/schemas.ts`).

---

## 2. New database tables (one migration)

New migration `supabase/migrations/<ts>_fair_clasification.sql`. All tables `tournament_id`-keyed, all RLS-enabled, mirroring existing patterns (SELECT for `authenticated`; writes via `is_admin()` / service role).

### 2.1 `fair_added_time_goals` — admin source data (the ONLY hand-edited fair table)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK → tournaments CASCADE | |
| fixture_id | uuid FK → fixtures CASCADE | |
| team_id | uuid FK → teams RESTRICT | the team that scored stoppage-time goals |
| goals | integer, `> 0` | stoppage-time (90+) goals to subtract |
| created_at, updated_at | timestamptz | `set_updated_at` trigger |
| UNIQUE | (fixture_id, team_id) | |

CHECK / app guard: `goals` for a team must not exceed that team's real `*_goals_90` (validated in the action; see §4).

### 2.2 `fair_match_results` — the derived *Resultado Justo* (regenerated, never hand-edited)

Subset of `match_results` needed by the scorers + display.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| fixture_id | uuid UNIQUE FK CASCADE | |
| home_goals_90, away_goals_90 | integer ≥ 0 | fair score |
| went_extra_time | boolean | per §1.2 |
| went_penalties | boolean | always false in fair world (kept for symmetry) |
| winner_team_id | uuid FK → teams SET NULL | fair 90' winner (null on fair draw) |
| qualified_team_id | uuid FK → teams SET NULL | fair advancer |
| computed_at | timestamptz | |

Only fixtures with a **confirmed** real `match_results` row produce a fair row. Fully regenerated (delete+insert by tournament) on each fair recalc.

### 2.3 `fair_prediction_scores` — same shape as `prediction_scores`

Identical columns to `prediction_scores` (`user_id`, `fixture_id`, `prediction_type`, `scoring_rules_version`, `points_total numeric(8,2)`, `points_breakdown jsonb`, `calculated_at`). Fully regenerated on each fair recalc.

- `group_phase` / `knockout` rows → computed from `fair_match_results`.
- `initial` / `group_qualification` rows → **copied verbatim** from the live `prediction_scores` (real-results values), per the brief.

### 2.4 Clasificación Justa — **no table** (decision, not an open question)

The real app does **not** persist a leaderboard (`leaderboard_snapshots` is unused); it aggregates `prediction_scores` on the fly in TS (`leaderboard.ts`). We mirror that: the fair leaderboard is aggregated on the fly from `fair_prediction_scores`. Adding a 4th persisted "clasificación justa" table would only introduce a staleness layer for ~10 users. We therefore intentionally skip the table the brief loosely suggests and keep `fair_prediction_scores` as the single fair source of truth.

### 2.5 Migration housekeeping

- Add `set_updated_at` triggers where columns exist.
- RLS policies cloned from `prediction_scores` / `match_results` (SELECT authenticated; admin write; service role bypass for recalc).
- After applying locally: `npm run types:gen` to regenerate `src/lib/supabase/database.types.ts`.
- Prod: `npm run db:push` (manual), then run the seed + fair recalc (§7).

---

## 3. New scoring pipeline (server code)

New module folder `src/lib/scoring/fair/` (keeps the real engine untouched, maximises reuse of pure functions).

### 3.1 `deriveFairResult.ts`
Pure function implementing §1.1/§1.2. Input: real result row + added-time goals per side + `isKnockout`. Output: the `fair_match_results` column set. Includes the negative-goal guard (clamp / validation).

### 3.2 `recalculateFairCore.ts` — fair orchestrator
A trimmed clone of [`recalculateCore.ts`](../../../src/lib/scoring/recalculateCore.ts):

```
1. Load active scoring_rules (same as real).
2. DELETE fair_match_results, fair_prediction_scores WHERE tournament_id = ?.
3. Load fixtures, stages, rounds, teams (same maps as real).
4. Load CONFIRMED match_results + all fair_added_time_goals.
5. For each confirmed result → deriveFairResult → INSERT fair_match_results.
6. Load match_predictions; for each with a fair_match_results row:
      scoreGroupMatch | scoreKnockoutMatch (REUSED unchanged) against the fair result
      → INSERT fair_prediction_scores (group_phase|knockout).
7. Copy initial + group_qualification rows from prediction_scores verbatim
      → INSERT into fair_prediction_scores (same points/breakdown).
8. Return counts.
```

Key reuse: `scoreMatch.ts`, `applyMultiplier.ts`, `rules.ts`, `types.ts`, `fetchAllRows`, the stage/round/team maps — all imported as-is. Uses the **service-role/admin client** (full delete/insert, bypass RLS) exactly like the real core.

### 3.3 `recalculateFair.ts` — server-only wrapper
Mirrors `recalculate.ts`: `recalculateFairTournamentScores(tournamentId)` builds the admin client and calls the core. Used by the admin button and the seed script.

### 3.4 Fair leaderboard loader
`src/lib/scoring/fair/fairLeaderboard.ts`: a thin clone of `loadLeaderboardData` that reads `fair_prediction_scores` (and `fair_match_results` for the Real-vs-Justo display) but returns the **same `LeaderboardData` shape**. Then `buildGeneralRanking`, `buildByRound`, `buildByStage`, `buildByCategory`, `buildEvolution` from [`leaderboard.ts`](../../../src/lib/scoring/leaderboard.ts) are **reused unchanged**.
- Cleaner alternative: refactor `loadLeaderboardData` to take a `{ scoresTable }` param so one loader serves both. Acceptable since it's a pure additive param with a default → real behaviour unchanged. (Pick during implementation; both honor the hard rule.)

---

## 4. Admin: capturing stoppage-time goals

The brief wants this on the existing result form (`/admin/results/[fixtureId]`).

### 4.1 UI (`ResultForm.tsx`) — additive block
New `<div>` "**Goles al 90'**": two number inputs (home / away), placeholder `0`, blank = 0. Rendered below the existing "Resultado Real" inputs. Shows a live preview of the resulting *Resultado Justo*. Prefilled from any existing `fair_added_time_goals` rows for the fixture.

### 4.2 Action (`admin/results/actions.ts`) — additive write only
In `persistResult`, **after** the untouched real `match_results` upsert + recalc:
1. Parse the two added-time numbers; validate `0 ≤ added ≤ real_goals_90` per side.
2. Upsert/delete `fair_added_time_goals` rows for the fixture (one row per team with `goals > 0`; remove rows that drop to 0). Independent statements — the real result write path is **not** modified.
3. On `confirmed`, call `recalculateFairTournamentScores(tournament.id)` after the real `recalculateTournamentScores`.

The real-results code path keeps working even if every fair statement were removed — fair writes are strictly appended.

### 4.3 Manual fallback
`recalculateFairClasificacion()` server action + an admin "**Calcular Puntuación Justa**" button on the Clasificación Justa page (mirrors `recalculateClasificacion()` on `/clasificacion/jornada`). Zero-risk manual recompute; also covers seed-time and any drift.

---

## 5. New pages — route group `/(app)/porra-justa/`

Placed under `src/app/(app)/porra-justa/` so they inherit the same layout, header and auth gate as the rest of the app.

### 5.1 `/porra-justa/predicciones` — "Predicciones Partidos Justos" (read-only)
Per the brief: same idea as Predicciones Partidos, but read-only and driven by the *Resultado Justo*.
- List fixtures **that have a fair result**, grouped by jornada (reuse round ordering).
- For each fixture show: **Resultado Real** (small, muted) and **Resultado Justo** (larger, highlighted — the one points are based on).
- Per user: fair points + breakdown popover + points bar, reusing `BreakdownTable`, `BreakdownPopover`, `PointsBar` against `fair_prediction_scores` (essentially a fair-data clone of `LockedFixturePanel`).
- No form, no editing. Predictions are visible because any fixture with a result is in a locked round (consistent with existing RLS exposure after lock).

### 5.2 `/porra-justa/clasificacion` — "Clasificación Justa"
Clone of `/clasificacion/jornada` (the main ranking) reading the fair loader:
- Reuse `JornadaTable` (+ pichichi / mejor jugador / clasificados columns, which come from the copied real `initial`/`group_qualification` rows) and `buildByRound`.
- Admin "Calcular Puntuación Justa" button (§4.3).
- Grand-total column = the fair tournament ranking.

> MVP = the two pages the brief asks for. The other fair tabs (fase / categoría / evolución) are trivial to add later since the builders already work on the fair loader, but are out of scope unless requested.

### 5.3 Navbar — additive "La Porra Justa" dropdown (`HeaderClient.tsx`)
Add a second dropdown next to "Clasificación", modelled on the existing `ClasificacionDropdown`:
- Items: **Predicciones Partidos Justos** → `/porra-justa/predicciones`, **Clasificación Justa** → `/porra-justa/clasificacion`.
- Mirror the same active-state + mobile list additions. Purely additive to `NAV_ITEMS` / mobile `allItems`.

---

## 6. Seeding the initial late-goal data

One-off script `scripts/wc2026/seed-fair-added-time.ts` (env-guarded like other wc2026 scripts):
1. Read `context/implementations/2026-06-30/fair_clasification.json`.
2. For each entry: resolve `external_id` → live `fixtures` row → its `home_team_id` / `away_team_id`.
3. Resolve each `equipo` name to one of those two teams by matching `teams.display_name` / `aliases` (names in the JSON match `display_name`, verified). Fail loudly on no/ambiguous match (esp. knockout fixtures whose teams were assigned by pairings).
4. Validate `goles ≤` that team's real `*_goals_90` from the confirmed `match_results`.
5. Upsert into `fair_added_time_goals` (onConflict `fixture_id,team_id`).
6. Call `recalculateFairTournamentScores`.

Refuses remote writes unless an explicit `--confirm-prod` flag (mirror `scoring:smoke`). Add an `npm` script alias.

---

## 7. Rollout order (run on approval — NOT executed in this plan)

1. Write migration → `npm run db:reset` (local) → `npm run types:gen`.
2. Implement `src/lib/scoring/fair/*`, pages, nav, admin form additions.
3. Local verify: enter a few added-time values, confirm a result, check `/porra-justa/*`, cross-check totals with SQL (real vs fair) and the worked Case 1 / Case 2 examples.
4. Prod: `npm run db:push` (manual migration).
5. Run `scripts/wc2026/seed-fair-added-time.ts --confirm-prod` against prod (Supabase MCP/CLI available) to insert the 22 late-goal records and run the first fair recalc.
6. Spot-check Clasificación Justa vs Clasificación on prod; deploy frontend via Vercel (merge to `master`).

## 8. Verification (no automated tests — project convention)

- SQL diff of `prediction_scores` vs `fair_prediction_scores` per user; the delta should only come from fixtures present in `fair_added_time_goals`.
- Manually verify `wc2026_md1_e_civ_ecu` (group, Costa de Marfil 2‑1 → fair 1‑1), `wc2026_r32_*` (knockout Case 1/2 behaviour), and that `initial` + `group_qualification` fair rows equal the real rows exactly.
- Confirm real `/clasificacion/*` totals are **unchanged** after the whole feature ships.

---

## Open Questions (only the genuinely ambiguous / critical)

1. **Knockout fair draw where the real match also went to ET/penalties** (both teams scored in stoppage time, net still level — none in the current JSON). Plan assumes counterfactual ET semantics: reward **prórroga only, never penaltis**, and keep the **real** advancer. Confirm this is desired if such a match ever occurs, vs. honoring the real penalti shootout in that specific sub-case. Answer: yes, in that particular case in which both teams scored in added time but the match went to the same state as the real match, then use what happened in the real match (if the real match ended up in penalties and team A went through, use it).

2. **Fair qualifier that contradicts reality (Case 2).** Per the brief, when the Resultado Justo has a 90' winner we set the fair advancer to that **fair winner**, even though a *different* team really advanced (e.g. on penalties). Confirm leaderboards/UI should show this fair (counterfactual) advancer everywhere in La Porra Justa, including who gets `correct_qualified_team`. (Plan implements it this way.) Answer: Yes, we should show whenever we are seeing the Predicciones Partidos Justos, we should see the REAL match and below in a separate section the "Justo" scenario, and mark somehow which team will have gone through in that scenario and use it for the new scoring.
