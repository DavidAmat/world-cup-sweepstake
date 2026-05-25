import Link from "next/link";

// Static tab bar — server component, no client state. The active tab
// is passed via prop so each subpage can mark itself.

export type TabKey = "general" | "jornada" | "fase" | "categoria" | "evolucion";

const TABS: { key: TabKey; href: string; label: string }[] = [
  { key: "general", href: "/clasificacion", label: "General" },
  { key: "jornada", href: "/clasificacion/jornada", label: "Por jornada" },
  { key: "fase", href: "/clasificacion/fase", label: "Por fase" },
  { key: "categoria", href: "/clasificacion/categoria", label: "Por categoría" },
  { key: "evolucion", href: "/clasificacion/evolucion", label: "Evolución" },
];

export function ClasificacionTabs({ active }: { active: TabKey }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-1.5 border-b border-zinc-200 pb-2 dark:border-zinc-800">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition " +
              (isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
