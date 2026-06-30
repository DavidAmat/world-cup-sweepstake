"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  ChevronDown,
  Shield,
  Home,
  ListChecks,
  ClipboardList,
  BarChart2,
  Scale,
  User,
} from "lucide-react";
import { Avatar } from "@/components/profiles/Avatar";

type NavProps = {
  displayName: string | null;
  initials: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
  signOutForm: React.ReactNode;
  onClose?: () => void;
};

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home, exact: true },
  { href: "/predictions/initial", label: "Predicciones Iniciales", icon: ListChecks, exact: false },
  {
    href: "/predictions/matches",
    label: "Predicciones Partidos",
    icon: ClipboardList,
    exact: false,
  },
];

const CLASIFICACION_ITEMS = [
  { href: "/clasificacion/jornada", label: "Clasificación" },
  { href: "/my-scores", label: "Mis Predicciones" },
];

const PORRA_JUSTA_ITEMS = [
  { href: "/porra-justa/predicciones", label: "Predicciones Partidos Justos" },
  { href: "/porra-justa/clasificacion", label: "Clasificación Justa" },
  { href: "/porra-justa/perjudicados", label: "Perjudicados" },
];

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname.startsWith(href);
}

function isClasificacionActive(pathname: string) {
  return pathname.startsWith("/clasificacion") || pathname.startsWith("/my-scores");
}

function isPorraJustaActive(pathname: string) {
  return pathname.startsWith("/porra-justa");
}

const LINK_BASE =
  "relative flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-2.5 py-1.5";
const LINK_IDLE = "text-zinc-600 hover:text-zinc-900 hover:bg-white/60";
const LINK_ACTIVE = "text-primary bg-white/70 shadow-sm";

function ActiveDot() {
  return (
    <span className="bg-primary absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" />
  );
}

function NavDropdown({
  label,
  icon: Icon,
  items,
  active,
  pathname,
  onClose,
}: {
  label: string;
  icon: typeof BarChart2;
  items: { href: string; label: string }[];
  active: boolean;
  pathname: string;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${LINK_BASE} ${active ? LINK_ACTIVE : LINK_IDLE}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        {active && !open && <ActiveDot />}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[180px] rounded-xl border border-white/40 bg-white/90 p-1.5 shadow-lg backdrop-blur-md">
          {items.map((item) => {
            const a = pathname === item.href || pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  setOpen(false);
                  onClose?.();
                }}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  a ? "bg-primary/10 text-primary" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DesktopNav({
  displayName,
  initials,
  avatarUrl,
  isAdmin,
  isLoggedIn,
  signOutForm,
}: NavProps) {
  const pathname = usePathname();

  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="bg-primary rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            className={`${LINK_BASE} ${active ? LINK_ACTIVE : LINK_IDLE}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {label}
            {active && <ActiveDot />}
          </Link>
        );
      })}

      <NavDropdown
        label="Clasificación"
        icon={BarChart2}
        items={CLASIFICACION_ITEMS}
        active={isClasificacionActive(pathname)}
        pathname={pathname}
      />

      <NavDropdown
        label="La Porra Justa"
        icon={Scale}
        items={PORRA_JUSTA_ITEMS}
        active={isPorraJustaActive(pathname)}
        pathname={pathname}
      />

      {isAdmin && (
        <Link
          href="/admin"
          className={`${LINK_BASE} ${pathname.startsWith("/admin") ? LINK_ACTIVE : LINK_IDLE}`}
        >
          <Shield className="text-special h-3.5 w-3.5 shrink-0" aria-hidden />
          Admin
          {pathname.startsWith("/admin") && <ActiveDot />}
        </Link>
      )}

      <div className="ml-3 flex items-center gap-2 border-l border-zinc-200 pl-3">
        <Link
          href="/perfil"
          title="Mi perfil"
          className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-white/60 hover:text-zinc-900 ${
            pathname.startsWith("/perfil") ? "text-primary" : ""
          }`}
        >
          <Avatar
            displayName={displayName ?? "Jugador"}
            initials={initials ?? "?"}
            avatarUrl={avatarUrl}
            size={22}
          />
          <span className="hidden lg:inline">{displayName ?? "—"}</span>
          {isAdmin && (
            <Shield className="text-special h-3 w-3 shrink-0" aria-label="Administrador" />
          )}
        </Link>
        {signOutForm}
      </div>
    </nav>
  );
}

function MobileNav({
  displayName,
  initials,
  avatarUrl,
  isAdmin,
  isLoggedIn,
  signOutForm,
  onClose,
}: NavProps) {
  const pathname = usePathname();

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col gap-2 pt-2 pb-3">
        <Link
          href="/login"
          onClick={onClose}
          className="bg-primary rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  const allItems = [
    ...NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => ({
      href,
      label,
      icon: Icon,
      active: isActive(pathname, href, exact),
    })),
    ...CLASIFICACION_ITEMS.map(({ href, label }) => ({
      href,
      label,
      icon: BarChart2,
      active: pathname === href || (pathname.startsWith(href) && href !== "/clasificacion"),
    })),
    ...PORRA_JUSTA_ITEMS.map(({ href, label }) => ({
      href,
      label,
      icon: Scale,
      active: pathname === href || pathname.startsWith(href),
    })),
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: "Admin",
            icon: Shield,
            active: pathname.startsWith("/admin"),
          },
        ]
      : []),
    {
      href: "/perfil",
      label: "Mi perfil",
      icon: User,
      active: pathname.startsWith("/perfil"),
    },
  ];

  return (
    <div className="flex flex-col gap-1 py-3">
      <p className="flex items-center gap-2 px-3 pb-2 text-xs text-zinc-500">
        <Avatar
          displayName={displayName ?? "Jugador"}
          initials={initials ?? "?"}
          avatarUrl={avatarUrl}
          size={22}
        />
        Hola, {displayName ?? "jugador"}
        {isAdmin && <Shield className="text-special h-3 w-3 shrink-0" aria-label="Administrador" />}
      </p>
      {allItems.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          onClick={onClose}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            active ? "bg-primary/10 text-primary" : "text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
      <div className="mt-2 border-t border-zinc-100 px-3 pt-2">{signOutForm}</div>
    </div>
  );
}

type Props = {
  displayName: string | null;
  initials: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
  signOutForm: React.ReactNode;
};

export function HeaderClient({
  displayName,
  initials,
  avatarUrl,
  isAdmin,
  isLoggedIn,
  signOutForm,
}: Props) {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled();
  const navProps: NavProps = {
    displayName,
    initials,
    avatarUrl,
    isAdmin,
    isLoggedIn,
    signOutForm,
  };

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/40 bg-white/80 shadow-sm backdrop-blur-md"
          : "border-b border-transparent bg-white/70 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="focus-visible:ring-primary flex items-center gap-2 rounded-md px-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="text-base font-bold tracking-tight text-zinc-900">
            Porra Mundial <span className="text-primary">2026</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex">
          <DesktopNav {...navProps} />
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="focus-visible:ring-primary flex items-center justify-center rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:outline-none md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {/* Mobile nav panel */}
      {open && (
        <div className="border-t border-zinc-100 bg-white/95 px-4 backdrop-blur-md md:hidden">
          <MobileNav {...navProps} onClose={() => setOpen(false)} />
        </div>
      )}
    </header>
  );
}
