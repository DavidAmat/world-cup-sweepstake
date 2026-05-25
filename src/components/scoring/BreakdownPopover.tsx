"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Click-to-open breakdown popover. The body is server-rendered
// (BreakdownTable wrapped here) and passed as `children`.
//
// Two state modes:
//   - Uncontrolled (default): the popover owns its open/close state.
//   - Controlled: pass `isOpen` + `onToggle` so a parent can coordinate
//     a group of popovers — e.g. the LockedFixturePanel allows only ONE
//     open at a time per fixture by sharing a single `openId`.
//
// The popover renders through a portal into document.body with
// `position: fixed`, which sidesteps any `overflow-hidden` on ancestors
// (the LockedFixturePanel had one for rounded corners, which was
// clipping the popover before this change).

const POPOVER_WIDTH = 384; // matches Tailwind w-96 — kept in sync with the className below

type Props = {
  pointsTotal: number;
  label?: string;
  children: ReactNode;
  isOpen?: boolean;
  onToggle?: (next: boolean) => void;
};

export function BreakdownPopover({ pointsTotal, label, children, isOpen, onToggle }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = isOpen !== undefined && onToggle !== undefined;
  const open = isControlled ? isOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onToggle(v);
    else setInternalOpen(v);
  };

  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Only render the portal on the client. The flag flips via
  // requestAnimationFrame instead of synchronously inside the effect to
  // satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Reposition on scroll/resize while the popover is open. The initial
  // computation happens in the click handler below (so the first render
  // already has the correct `pos`).
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      let left = rect.right - POPOVER_WIDTH;
      if (left < 8) left = 8;
      if (left + POPOVER_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - POPOVER_WIDTH - 8;
      }
      setPos({ top: rect.bottom + 4, left });
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    if (next) {
      const btn = btnRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        let left = rect.right - POPOVER_WIDTH;
        if (left < 8) left = 8;
        if (left + POPOVER_WIDTH > window.innerWidth - 8) {
          left = window.innerWidth - POPOVER_WIDTH - 8;
        }
        setPos({ top: rect.bottom + 4, left });
      }
    }
    setOpen(next);
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !popoverRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
    // setOpen identity depends on controlled vs not; we intentionally
    // re-read it from closure each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-expanded={open}
        aria-label={label ?? "Ver desglose de puntos"}
      >
        <span className="font-mono">{pointsTotal} pts</span>
        <span aria-hidden="true" className="text-zinc-400">
          ⓘ
        </span>
      </button>
      {mounted &&
        open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            className="fixed z-50 w-96 rounded-lg border border-zinc-200 bg-white p-4 text-left text-sm shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            style={{ top: pos.top, left: pos.left }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
