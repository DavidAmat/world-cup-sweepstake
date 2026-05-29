import { requireAuth } from "@/lib/permissions/requireAuth";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Avatar } from "@/components/profiles/Avatar";
import { avatarUrlFor } from "@/lib/profiles/avatars";
import { CheckCircle2, User } from "lucide-react";

type SearchParams = Promise<{ error?: string; ok?: string }>;

export default async function PerfilPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, ok } = await searchParams;
  const { userId, email, supabase } = await requireAuth();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, initials, role")
    .eq("user_id", userId)
    .single();

  const displayName = profile?.display_name ?? "Jugador";

  return (
    <main className="mx-auto w-full max-w-md p-10">
      <div className="flex items-center gap-4">
        <Avatar
          displayName={displayName}
          initials={profile?.initials ?? "?"}
          avatarUrl={avatarUrlFor(displayName)}
          size={56}
        />
        <div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-sm text-zinc-500">{email}</p>
          {profile?.role === "admin" && (
            <span className="text-primary mt-1 inline-block text-xs font-semibold">
              Administrador
            </span>
          )}
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-zinc-400" aria-hidden />
          <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          Puedes actualizar tu contraseña en cualquier momento.
        </p>

        {ok && (
          <div className="border-success/30 bg-success/10 text-success-fg mt-4 flex items-center gap-2 rounded-md border px-4 py-3 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>Contraseña actualizada correctamente.</span>
          </div>
        )}
        {error && <ErrorBanner message={error} className="mt-4" />}

        <ChangePasswordForm
          origin="/perfil"
          next="/perfil?ok=1"
          submitLabel="Actualizar contraseña"
        />
      </section>
    </main>
  );
}
