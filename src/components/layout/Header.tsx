import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import { avatarUrlFor } from "@/lib/profiles/avatars";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { HeaderClient } from "./HeaderClient";

export async function Header() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  let displayName: string | null = null;
  let initials: string | null = null;
  let isAdmin = false;
  if (claims?.sub) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, initials, role")
      .eq("user_id", claims.sub)
      .single();
    displayName = profile?.display_name ?? null;
    initials = profile?.initials ?? null;
    isAdmin = profile?.role === "admin";
  }
  const avatarUrl = avatarUrlFor(displayName);

  const signOutForm = (
    <form action={signOut}>
      <SubmitButton className="hover:text-primary focus-visible:ring-primary inline-flex items-center gap-1.5 rounded px-1 text-sm font-medium text-zinc-700 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-70">
        Cerrar sesión
      </SubmitButton>
    </form>
  );

  return (
    <HeaderClient
      displayName={displayName}
      initials={initials}
      avatarUrl={avatarUrl}
      isAdmin={isAdmin}
      isLoggedIn={!!claims?.sub}
      signOutForm={signOutForm}
    />
  );
}
