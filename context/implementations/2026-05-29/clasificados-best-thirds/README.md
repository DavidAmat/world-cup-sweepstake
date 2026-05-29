# 2026-05-29 — Clasificados best-8-thirds rule, scoring & admin standings

## Goal (user request)

WC2026 sends the top 2 of every group **plus the 8 best third-placed teams** to
the round of 32. On `/predictions/initial` the clasificados picker must let the
user choose, per group, the teams they think advance — gated so they can only
save when **exactly 8 groups have 3 teams** selected and the rest have **≥2**
(→ 32 advancing). Scoring must compute the best-8 thirds on the fly (rank the 12
thirds, take the top 8) so it's easy, and the admin must be able to see the live
per-group standings + thirds ranking and fix things by editing results.

## Design (number = 8 best thirds)

The user's message said "best eight … third position" and "8 groups, three
options" (consistent with 32 = 24 + 8) but once wrote "top five" — taken as a
slip. Implemented with `BEST_THIRDS_ADVANCE = 8` (single constant in
`src/lib/scoring/scoreGroup.ts`); change it there if the format ever differs.

## What shipped (no DB migration needed)

`group_qualification_predictions` already stores 2–3 rows per group, so **no
schema change** — only validation + scoring + UI.

- **`scoreGroup.ts`**: `compareStandings` helper; `computeAdvancingTeams(tables, expectedGroups, thirdsAdvance)` → top-2 of every complete group + best-`thirdsAdvance` thirds (ranked globally, resolved only when **all** groups complete); `scoreGroupQualificationPrediction` now takes the global advancing `Set` and awards 25/hit.
- **`recalculateCore.ts`**: builds `advancingTeams` (gated on `hasR32`), scores gqp against it (replaced the old top-2-only path; removed the `void hasR32` marker).
- **`/predictions/initial`**: `schemas.ts` `MIN_QUALIFIERS=2`/`MAX_QUALIFIERS=3`; `actions.ts` validates 2–3 per group + exactly 8 with 3; new **`ClasificadosPicker`** client component (live counter, caps at 3, disables Guardar until valid); read-only evaluation now uses `computeAdvancingTeams.byGroup`.
- **`/admin/standings`** (new): live per-group tables + ranked best thirds (provisional until all groups complete); card added to `/admin`.

## Verification (passed)

`typecheck`, `lint`, `prettier`, `build` clean. Logic test with 12 synthetic
complete groups: advancing = 32, best thirds A–H advance / I–L don't, a pick
whose third advanced scored 75 (3×25) vs 50 (2×25) when it didn't, and with one
group incomplete no third was marked advanced. Authenticated UI (picker gating,
admin standings) to confirm in-browser.

## Pending prod

No migration. Code-only — ships with the next `master` deploy. Tracked in
`documentation/implementations/pending-prod-migrations.md`.
