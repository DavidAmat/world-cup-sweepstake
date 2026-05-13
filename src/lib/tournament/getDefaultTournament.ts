import "server-only";
import { createClient } from "@/lib/supabase/server";

// Single-tournament shortcut. When the app grows to N tournaments
// running side-by-side we replace this with a selector that reads
// from searchParams or a cookie.
export async function getDefaultTournament() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG;
  if (!slug) {
    throw new Error("NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG is not set");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, slug, name, year, status, predictions_open_until")
    .eq("slug", slug)
    .single();
  if (error || !data) {
    throw new Error(`Tournament '${slug}' not found in DB`);
  }
  return data;
}
