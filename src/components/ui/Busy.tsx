"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  Suspense,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Global "busy" coordinator.
 *
 * The deployed app runs on Vercel's free tier, so any button that triggers a
 * server action or a navigation can take several seconds to resolve. While that
 * is happening we want to (a) show a wait cursor, and (b) block any further
 * clicks so the user can't fire a second action or navigate away mid-flight.
 *
 * `begin()` / `end()` keep a reference count of in-flight operations; whenever
 * the count is > 0 we render a full-screen, click-swallowing overlay. The count
 * is also force-reset whenever the URL changes, which covers plain GET-form
 * navigations and any `redirect()` inside a server action.
 */

type BusyContextValue = {
  begin: () => void;
  end: () => void;
  reset: () => void;
};

const BusyContext = createContext<BusyContextValue | null>(null);

export function BusyProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const begin = useCallback(() => setCount((c) => c + 1), []);
  const end = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  const reset = useCallback(() => setCount(0), []);

  const active = count > 0;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.busy = active ? "true" : "";
    return () => {
      document.body.dataset.busy = "";
    };
  }, [active]);

  return (
    <BusyContext.Provider value={{ begin, end, reset }}>
      <Suspense fallback={null}>
        <NavReset onNavigate={reset} />
      </Suspense>
      {children}
      <BusyOverlay active={active} />
    </BusyContext.Provider>
  );
}

/**
 * Clears the busy state whenever the route or query string changes — i.e. once
 * a navigation has actually completed. Isolated in its own component (wrapped in
 * Suspense by the provider) so `useSearchParams()` doesn't opt the whole app
 * into client-side rendering.
 */
function NavReset({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    onNavigate();
  }, [pathname, search, onNavigate]);
  return null;
}

function BusyOverlay({ active }: { active: boolean }) {
  // `active` is always false on the server and during hydration (count starts
  // at 0), so the portal only ever renders client-side after a user action —
  // no hydration mismatch, and `document` is guaranteed to exist by then.
  if (!active || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] cursor-wait bg-transparent" aria-hidden="true">
      <div className="pointer-events-none fixed right-4 bottom-4 flex items-center gap-2 rounded-full bg-zinc-900/85 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Procesando…
      </div>
    </div>,
    document.body,
  );
}

function useBusyContext(): BusyContextValue {
  const ctx = useContext(BusyContext);
  if (!ctx) {
    // No provider in the tree (e.g. an isolated render): degrade to no-ops so
    // buttons still work without the global overlay.
    return { begin: () => {}, end: () => {}, reset: () => {} };
  }
  return ctx;
}

/** Imperative access to the global busy counter. */
export function useBusy(): BusyContextValue {
  return useBusyContext();
}

/**
 * Holds the global busy state for as long as `active` is true. Used to bridge
 * local pending flags (`useFormStatus`, `useTransition`, `useActionState`) into
 * the shared overlay.
 */
export function useBusyWhile(active: boolean): void {
  const { begin, end } = useBusyContext();
  useEffect(() => {
    if (!active) return;
    begin();
    return () => end();
  }, [active, begin, end]);
}
