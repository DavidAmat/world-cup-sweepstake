"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useBusy, useBusyWhile } from "./Busy";

type ButtonProps = React.ComponentProps<"button">;

type SubmitButtonProps = ButtonProps & {
  /**
   * Optional server action for this specific button. When several submit
   * buttons share one `<form>`, pass each button's own action so only the
   * clicked one shows its spinner (all of them still get disabled).
   */
  formAction?: ButtonProps["formAction"];
  /** Label shown while this button's submission is in flight. */
  pendingText?: string;
};

/**
 * Drop-in replacement for `<button type="submit">` inside a `<form action={...}>`.
 *
 * While the form is submitting it disables itself, shows an inline spinner and
 * raises the global busy overlay (blocking clicks elsewhere). Works inside both
 * Server- and Client-Component forms because it's a client component that reads
 * the enclosing form's status via `useFormStatus`.
 */
export function SubmitButton({
  children,
  className,
  disabled,
  formAction,
  pendingText,
  ...rest
}: SubmitButtonProps) {
  const { pending, action } = useFormStatus();

  // `pending` is true while *any* submission of this form is in flight. When a
  // button targets a specific action, only spin the one that was actually
  // dispatched; otherwise spin whenever the form is pending.
  const isThisPending = pending && (formAction ? action === formAction : true);

  // Any in-flight submission of this form blocks the rest of the page.
  useBusyWhile(pending);

  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending || disabled}
      aria-busy={isThisPending || undefined}
      data-pending={isThisPending ? "" : undefined}
      className={className}
      {...rest}
    >
      {isThisPending && (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
      )}
      {isThisPending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * Submit button for plain `<form method="get">` filter/navigation forms (no
 * server action, so `useFormStatus` never reports pending). It raises the busy
 * overlay on click; the provider clears it once the navigation completes.
 */
export function NavSubmitButton({ children, onClick, ...rest }: ButtonProps) {
  const { begin } = useBusy();
  return (
    <button
      type="submit"
      onClick={(e) => {
        // Honour native validity so we don't get stuck busy on an invalid form.
        if (e.currentTarget.form?.checkValidity() === false) return;
        begin();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
