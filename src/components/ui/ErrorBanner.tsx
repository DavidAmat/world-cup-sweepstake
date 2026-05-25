import { AlertCircle } from "lucide-react";

type Props = {
  message: string;
  className?: string;
};

export function ErrorBanner({ message, className = "" }: Props) {
  return (
    <div
      role="alert"
      className={
        "border-danger-light bg-danger-light text-danger-fg flex items-start gap-2 rounded-md border px-4 py-3 text-sm " +
        className
      }
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
