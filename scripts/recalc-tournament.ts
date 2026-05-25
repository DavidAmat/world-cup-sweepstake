// One-off helper: recalculates prediction_scores for the active
// tournament. Use when users saved predictions AFTER match results were
// confirmed and never got a recalc fired for them.
//
// Run with: npx tsx scripts/recalc-tournament.ts

import { createClient } from "@supabase/supabase-js";
import { recalculateTournamentScoresCore } from "../src/lib/scoring/recalculateCore";
import type { Database } from "../src/lib/supabase/database.types";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  }

  const supabase = createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !tournament) throw new Error(`No active tournament found: ${error?.message}`);

  console.log(`Recalculating prediction_scores for tournament "${tournament.name}"…`);
  await recalculateTournamentScoresCore(supabase, tournament.id);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
