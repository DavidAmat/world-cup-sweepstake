import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";

export async function Header() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  let displayName: string | null = null;
  let isAdmin = false;
  if (claims?.sub) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, role")
      .eq("user_id", claims.sub)
      .single();
    displayName = profile?.display_name ?? null;
    isAdmin = profile?.role === "admin";
  }

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
        <Link href="/" className="font-bold tracking-tight">
          Porra Mundial 2026
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {claims ? (
            <>
              <span className="text-zinc-500">Hola, {displayName ?? "jugador"}</span>
              <Link href="/dashboard" className="hover:underline">
                Mi porra
              </Link>
              <Link href="/predictions/initial" className="hover:underline">
                Predicciones
              </Link>
              <Link href="/predictions/matches" className="hover:underline">
                Partidos
              </Link>
              {isAdmin && (
                <Link href="/admin" className="hover:underline">
                  Administración
                </Link>
              )}
              <form action={signOut}>
                <button type="submit" className="hover:underline">
                  Cerrar sesión
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">
                Iniciar sesión
              </Link>
              <Link href="/register" className="hover:underline">
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
