# Supabase PostgREST 1,000-row limit — missing match predictions in UI

Incident report for predictions that exist in the database but render as `— - —` in the locked-match ranking on `/predictions/matches`.

## Summary

Once every player had filled all 72 group-stage fixtures, production held **1,008** rows in `match_predictions` (14 users × 72 fixtures). Supabase/PostgREST returns at most **1,000 rows per request** unless the client paginates. The predictions page fetched the whole tournament in a single query with no `.range()` loop, so **8 rows were silently dropped** on every page load. Affected users saw empty scores in the UI even though SQL against the database showed the correct values.

Reported: 2026-06-26 (Payet's jornada 3 predictions visible in Supabase SQL Editor but not in David's locked-fixture ranking for Panamá vs Inglaterra).

## Symptoms

- Locked jornada fixture panel shows `— - —` for some users in the per-match ranking dropdown.
- Database queries (Supabase SQL Editor, MCP `execute_sql`) return the correct `home_goals_90` / `away_goals_90`.
- Issue appears after all (or nearly all) group fixtures have predictions — not a save/RLS bug.
- Scoring recalc could also miss the same 8 rows when reading `match_predictions` in one shot.

## Root cause

`src/app/(app)/predictions/matches/page.tsx` loaded all tournament predictions with:

```ts
supabase.from("match_predictions").select(...).eq("tournament_id", tournament.id)
```

No `.order()`, no pagination. PostgREST default `max-rows` is **1,000**. With 1,008 rows, the API truncates without error.

The UI builds `otherEntries` from this truncated list; missing rows become `prediction: null` → rendered as em dashes in `LockedFixturePanel`.

Same unbounded read existed in `src/lib/scoring/recalculateCore.ts` for the scoring engine.

## Verification (production, 2026-06-26)

```sql
-- Total predictions (over the cap)
SELECT COUNT(*) FROM public.match_predictions;
-- → 1008

-- Payet jornada 3: all filled (none missing)
SELECT f.external_id, mp.home_goals_90, mp.away_goals_90
FROM public.fixtures f
JOIN public.rounds r ON r.id = f.round_id AND r.code = 'group_md3'
JOIN public.profiles p ON p.display_name = 'Payet'
LEFT JOIN public.match_predictions mp
  ON mp.fixture_id = f.id AND mp.user_id = p.user_id
WHERE mp.id IS NULL;
-- → 0 rows

-- Rows beyond the 1,000 cap when ordered by id (examples)
-- Nona ×4, Laura ×1, David ×1, Carlota ×1, Orozco ×1, Mayol ×1
```

## Fix (commits `66e249e`, follow-up for `prediction_scores`)

1. Added `src/lib/supabase/fetchAllRows.ts` — pages through PostgREST with `.range(from, to)` in 1,000-row chunks until exhausted. Uses `.order("id")` for stable pagination.

2. Updated `src/app/(app)/predictions/matches/page.tsx` to use `fetchAllRows` for the tournament-wide `match_predictions` read.

3. Updated `src/lib/scoring/recalculateCore.ts` with the same pattern so recalc does not skip rows.

4. **Follow-up (2026-06-28):** the same cap also applied to **`prediction_scores`**. With 1,008 match score rows (and 1,176 total including group qualification), the matches page loaded scores in one query — so up to 8 match rows were dropped and the UI showed `0 pts` even when SQL had the correct breakdown. Example: David × `wc2026_md3_l_cro_gha` (exact 2-1 → 15 pts in DB, 0 in UI). Fixed by paginating `prediction_scores` in:
   - `src/app/(app)/predictions/matches/page.tsx`
   - `src/lib/scoring/leaderboard.ts`
   - `src/app/(app)/clasificacion/jornada/[roundCode]/page.tsx`

   Scoring computation was never wrong; only tournament-wide reads in the UI were incomplete.

## Post-deploy check

1. Open `/predictions/matches`, jornada 3, Panamá vs Inglaterra (locked).
2. Expand the ranking — Payet should show **0 - 2**, not dashes.
3. Spot-check other users previously affected (Nona, Laura, Carlota, etc.).
4. Optional: run admin recalc and confirm no drift in `prediction_scores`.

## Prevention

- Any query that can return more than ~1,000 rows must paginate (or filter down, e.g. by `fixture_id` / `round_id`).
- Rough capacity: `users × fixtures` for full-tournament reads. With 15 users and 104 fixtures, future knockout fill could reach ~1,560 rows — still needs pagination.
- Consider a lint or code comment on bare `.from("match_predictions").select(...)` without `.range()` when scoped only by `tournament_id`.

## Related files

- `src/lib/supabase/fetchAllRows.ts`
- `src/app/(app)/predictions/matches/page.tsx`
- `src/lib/scoring/recalculateCore.ts`
- `src/app/(app)/predictions/matches/LockedFixturePanel.tsx` (display only; not the bug source)

## References

- [Supabase JavaScript client — pagination](https://supabase.com/docs/reference/javascript/range)
- PostgREST `max-rows` default: 1,000
