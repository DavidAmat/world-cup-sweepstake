import { changePassword } from "@/app/cambiar-password/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

type Props = {
  /** Path to return to on validation error (e.g. "/cambiar-password" or "/perfil"). */
  origin: string;
  /** Path to redirect to on success. */
  next: string;
  /** Submit button label. */
  submitLabel?: string;
  /** Disable all inputs (used by the scam overlay). */
  disabled?: boolean;
};

export function ChangePasswordForm({
  origin,
  next,
  submitLabel = "Guardar contraseña",
  disabled = false,
}: Props) {
  return (
    <form action={changePassword} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="origin" value={origin} />
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Nueva contraseña</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={disabled}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
        />
        <span className="text-xs text-zinc-500">Mínimo 8 caracteres.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Repite la contraseña</span>
        <input
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={disabled}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </label>

      <SubmitButton
        disabled={disabled}
        className="bg-primary text-primary-fg mt-2 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        pendingText="Guardando…"
      >
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
