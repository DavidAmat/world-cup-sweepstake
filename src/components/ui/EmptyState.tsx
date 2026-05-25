import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon = Inbox, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Icon className="h-10 w-10 text-zinc-300" aria-hidden="true" />
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {description && <p className="max-w-xs text-xs text-zinc-500">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
