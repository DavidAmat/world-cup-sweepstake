import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 text-xs text-zinc-500">
        <span>© 2026 Porra Mundial</span>
        <Link href="/rules" className="hover:text-zinc-800 hover:underline">
          Reglas de puntuación
        </Link>
      </div>
    </footer>
  );
}
