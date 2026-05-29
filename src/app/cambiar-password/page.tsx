import { requireAuth } from "@/lib/permissions/requireAuth";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ScamExperience } from "./ScamExperience";
import { KeyRound } from "lucide-react";

type SearchParams = Promise<{ error?: string }>;

export default async function ChangePasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  const { userId, supabase } = await requireAuth();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, must_change_password, is_scam")
    .eq("user_id", userId)
    .single();

  const isScam = profile?.is_scam ?? false;
  const forced = profile?.must_change_password ?? false;

  return (
    <main className="relative mx-auto w-full max-w-md p-10">
      <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl">
        <KeyRound className="text-primary h-6 w-6" aria-hidden />
      </div>
      <h1 className="mt-4 text-2xl font-bold">Cambia tu contraseña</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {forced
          ? "Tu cuenta usa una contraseña temporal. Por seguridad, debes establecer una contraseña nueva antes de continuar."
          : "Establece una contraseña nueva para tu cuenta."}
      </p>

      {error && <ErrorBanner message={error} className="mt-4" />}

      <ChangePasswordForm origin="/cambiar-password" next="/" disabled={isScam} />

      {isScam && <ScamExperience />}
    </main>
  );
}
