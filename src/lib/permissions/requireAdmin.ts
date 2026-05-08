import "server-only";
import { redirect } from "next/navigation";
import { requireAuth } from "./requireAuth";

export async function requireAdmin() {
  const { userId, supabase } = await requireAuth();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, initials, role")
    .eq("user_id", userId)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  return { userId, supabase, profile };
}
