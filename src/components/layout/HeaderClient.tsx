"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

type NavProps = {
  displayName: string | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
  signOutForm: React.ReactNode;
  onClose?: () => void;
};

const LINK_CLS =
  "text-sm font-medium text-zinc-700 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1";

function NavLinks({ displayName, isAdmin, isLoggedIn, signOutForm, onClose }: NavProps) {
  if (!isLoggedIn) {
    return (
      <>
        <Link href="/login" className={LINK_CLS} onClick={onClose}>
          Iniciar sesión
        </Link>
        <Link href="/register" className={LINK_CLS} onClick={onClose}>
          Crear cuenta
        </Link>
      </>
    );
  }
  return (
    <>
      <span className="text-sm text-zinc-500">Hola, {displayName ?? "jugador"}</span>
      <Link href="/dashboard" className={LINK_CLS} onClick={onClose}>
        Mi porra
      </Link>
      <Link href="/predictions/initial" className={LINK_CLS} onClick={onClose}>
        Predicciones
      </Link>
      <Link href="/predictions/matches" className={LINK_CLS} onClick={onClose}>
        Partidos
      </Link>
      <Link href="/clasificacion" className={LINK_CLS} onClick={onClose}>
        Clasificación
      </Link>
      <Link href="/my-scores" className={LINK_CLS} onClick={onClose}>
        Mi puntuación
      </Link>
      {isAdmin && (
        <Link href="/admin" className={LINK_CLS} onClick={onClose}>
          Administración
        </Link>
      )}
      {signOutForm}
    </>
  );
}

type Props = {
  displayName: string | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
  signOutForm: React.ReactNode;
};

export function HeaderClient({ displayName, isAdmin, isLoggedIn, signOutForm }: Props) {
  const [open, setOpen] = useState(false);
  const navProps: NavProps = { displayName, isAdmin, isLoggedIn, signOutForm };

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-primary focus-visible:ring-primary rounded px-1 font-bold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          Porra Mundial 2026
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 md:flex">
          <NavLinks {...navProps} />
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="focus-visible:ring-primary flex items-center justify-center rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:outline-none md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile nav panel */}
      {open && (
        <div className="border-t border-zinc-100 bg-white px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-3 pt-3">
            <NavLinks {...navProps} onClose={() => setOpen(false)} />
          </nav>
        </div>
      )}
    </header>
  );
}
