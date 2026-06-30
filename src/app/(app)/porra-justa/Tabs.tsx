import Link from "next/link";

// Static tab bar for "La Porra Justa" (mirrors ClasificacionTabs).

export type FairTabKey = "predicciones" | "clasificacion";

const TABS: { key: FairTabKey; href: string; label: string }[] = [
  { key: "predicciones", href: "/porra-justa/predicciones", label: "Predicciones Partidos Justos" },
  { key: "clasificacion", href: "/porra-justa/clasificacion", label: "Clasificación Justa" },
];

export function PorraJustaTabs({ active }: { active: FairTabKey }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-1.5 border-b border-zinc-200 pb-2">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition " +
              (isActive ? "bg-primary text-primary-fg" : "text-zinc-700 hover:bg-zinc-100")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
