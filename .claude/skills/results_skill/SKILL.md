---
name: results_skill
description: Sync one or more real World Cup match results into the local and production Supabase databases and recalculate every player's puntuaciones. Use when the user gives a fixture external_id plus the result (e.g. "wc2026_md1_a_mex_rsa 2-0"), optionally with knockout extras (prórroga / penaltis / who advanced).
---

# Sync match results (resultados → puntuaciones)

Records confirmed real results in `match_results` and recalculates `prediction_scores`
for the active tournament, on **both** local and production Supabase. It drives the
script `scripts/wc2026/set-result.ts`, which reuses the app's own `deriveResult`
(so a scripted entry is identical to clicking "Confirmar" in `/admin/results`) and
the app's scoring engine (`recalculateTournamentScoresCore`).

## What the user provides

For each match: the **`external_id`** (from `data/seeds/wc_2026/fixtures.json`) and the
**90' score** `home-away` (home = `equipo_1`, away = `equipo_2` in the seed). Plus extras
**only for knockouts** (`tipo_partido: "eliminatoria"`) that were level at 90':
- which team advanced (`home` or `away`)
- whether it was decided on penalties

Group matches (`fase_grupos`) only ever need the 90' score — that is all that scores.

## Rules baked into the script (do not re-derive by hand)

- **Group:** only `--home90` / `--away90`. Winner is derived (null on a draw). No qualifier,
  no extra time, no penalties.
- **Knockout decided in 90' (not a draw):** only `--home90` / `--away90`. The 90' winner
  advances automatically; do not pass `--qualified`.
- **Knockout level at 90' (a draw):** extra time is *derived*. You MUST pass
  `--qualified=home|away` (who advanced — covers both "won in extra time" and "won on
  penalties"). Add `--penalties` only if it actually went to a shootout.
- The 120' score is never stored (matches the app). Goals/scorers are not entered here —
  they do not feed scoring (`pichichi` / `mejor jugador` are admin-judged free text).

## Procedure

Always confirm the score interpretation with the user first if anything is ambiguous
(especially knockout "who advanced"). Then:

### 1. Preview (recommended for knockouts) — local, no writes

```bash
npm run wc2026:set-result -- --external-id=<ID> --home90=<H> --away90=<A> [--qualified=home|away] [--penalties] --dry-run
```

Check the printed "Derived match_results columns" (winner / qualified / went_extra_time /
went_penalties) match the user's intent.

### 2. Apply to LOCAL

> If local has no fixtures (fresh `db:reset`), seed first: `npm run wc2026:upload`.

```bash
npm run wc2026:set-result -- --external-id=<ID> --home90=<H> --away90=<A> [--qualified=home|away] [--penalties]
```

### 3. Apply to PRODUCTION

```bash
npm run wc2026:set-result:prod -- --external-id=<ID> --home90=<H> --away90=<A> [--qualified=home|away] [--penalties]
```

The `:prod` script already carries `--confirm-prod`. Each run prints `Recalculating
prediction_scores (puntuaciones)` and a recalculated count — that is the puntuaciones sync.

### Single result — full example (group)

México 2 – 0 Sudáfrica (`wc2026_md1_a_mex_rsa`):

```bash
npm run wc2026:set-result -- --external-id=wc2026_md1_a_mex_rsa --home90=2 --away90=0
npm run wc2026:set-result:prod -- --external-id=wc2026_md1_a_mex_rsa --home90=2 --away90=0
```

### Single result — knockout example

R32 1–1 at 90', away team advances on penalties:

```bash
npm run wc2026:set-result:prod -- --external-id=wc2026_r32_01 --home90=1 --away90=1 --qualified=away --penalties
```

## Batch of results

A full recalc runs after every result by default. For a batch, that is redundant —
pass **`--no-recalc` on every result except the last one**, so the puntuaciones are
recalculated exactly once, at the end, via the same engine.

Run the whole batch against local first, then the identical batch against prod. Example
(jornada 1, three group results):

```bash
# LOCAL
npm run wc2026:set-result -- --external-id=wc2026_md1_a_mex_rsa --home90=2 --away90=0 --no-recalc
npm run wc2026:set-result -- --external-id=wc2026_md1_a_kor_cze --home90=1 --away90=1 --no-recalc
npm run wc2026:set-result -- --external-id=wc2026_md1_b_can_bih --home90=3 --away90=1   # last → recalc fires

# PROD (same lines, :prod)
npm run wc2026:set-result:prod -- --external-id=wc2026_md1_a_mex_rsa --home90=2 --away90=0 --no-recalc
npm run wc2026:set-result:prod -- --external-id=wc2026_md1_a_kor_cze --home90=1 --away90=1 --no-recalc
npm run wc2026:set-result:prod -- --external-id=wc2026_md1_b_can_bih --home90=3 --away90=1
```

Mixed group + knockout in one batch is fine — just attach the knockout extras to those lines.

## Verify

The script prints the derived columns, an upsert confirmation, and the recalc count.
To double-check the stored row + scores, query by `external_id` (read-only). Then tell
the user to confirm the score and updated leaderboard show in the deployed Vercel app.

## Notes / gotchas

- Re-running a result is safe — it upserts on `fixture_id` (overwrites, no duplicate).
- The fixture must already have both teams assigned. For knockouts that means the pairings
  must be set first; the script aborts with a clear message otherwise.
- Active tournament is resolved from the seed slug (`wc_2026`). Local URL host is rewritten
  to the LAN IP automatically (see `scripts/lib/env.ts`); prod requires `--confirm-prod`
  (already in the `:prod` npm script).
- Reference: result format & schema in `documentation/services/web/results-entry.md`;
  scoring engine in `context/web/scoring-engine.md`.
```
