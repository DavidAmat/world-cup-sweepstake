"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { createAdminClient } from "@/lib/supabase/admin";

const MIN_LENGTH = 8;

function fail(origin: string, message: string): never {
  redirect(`${origin}?error=${encodeURIComponent(message)}`);
}

export async function changePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const origin = String(formData.get("origin") ?? "/cambiar-password");
  const next = String(formData.get("next") ?? "/");

  const { userId, supabase } = await requireAuth();

  // Defense in depth: scam accounts can never change their password.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_scam")
    .eq("user_id", userId)
    .single();
  if (profile?.is_scam) {
    redirect("/cambiar-password");
  }

  if (password.length < MIN_LENGTH) {
    fail(origin, `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
  }
  if (password !== confirm) {
    fail(origin, "Las contraseñas no coinciden.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    fail(origin, error.message);
  }

  // Clear the forced-change flag with the service-role client (RLS pins this
  // column so the user can't change it from their own session).
  const admin = createAdminClient();
  const { error: flagErr } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("user_id", userId);
  if (flagErr) {
    fail(origin, flagErr.message);
  }

  redirect(next);
}
