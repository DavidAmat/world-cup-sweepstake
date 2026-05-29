"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateAuthError } from "./errors";

// Public self-registration is disabled: accounts are pre-created by the admin
// (see scripts/wc2026/create-users.ts). The /register page redirects to /login,
// but we also hard-stop the action here in case it is ever posted directly.
export async function signUp() {
  redirect(
    `/login?error=${encodeURIComponent(
      "El registro está deshabilitado. Pide tus credenciales al administrador.",
    )}`,
  );
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  // Audit log: record this successful login (username + Madrid timestamp is
  // derived at read time). This only fires on an actual email/password sign-in,
  // never on session refresh, and never blocks login if it fails.
  if (data.user) {
    try {
      await createAdminClient().from("login_events").insert({ user_id: data.user.id });
    } catch {
      // ignore — logging must never prevent the user from getting in
    }
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
