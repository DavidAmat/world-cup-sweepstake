"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/permissions/requireAuth";

// Hito 11 wires this to the active scoring_rules.version. Until then we
// record acceptances against version 0 so the audit trail is in place.
const PLACEHOLDER_RULES_VERSION = 0;

export async function acceptTerms(formData: FormData) {
  const tournamentId = String(formData.get("tournamentId") ?? "").trim();
  if (!tournamentId) redirect("/");

  const { userId, supabase } = await requireAuth();
  const { error } = await supabase.from("terms_acceptances").insert({
    tournament_id: tournamentId,
    user_id: userId,
    rules_version: PLACEHOLDER_RULES_VERSION,
  });

  // Idempotent — duplicate insert means already accepted, treat as success.
  if (error && !/duplicate key|unique constraint/i.test(error.message)) {
    redirect(`/rules?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/rules?ok=1");
}
