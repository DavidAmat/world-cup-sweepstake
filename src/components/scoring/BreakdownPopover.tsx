"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const POPOVER_WIDTH = 384;
const VIEWPORT_MARGIN = 8;
const GAP = 4;
const ESTIMATED_POPOVER_H = 280;

type Pos = { top: number; left: number; maxHeight: number };

function computePos(btn: HTMLElement, measuredH: number | null): Pos {
  const rect = btn.getBoundingClientRect();
  let left = rect.right - POPOVER_WIDTH;
  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
  if (left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
    left = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
  }

  const spaceBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;
  const needed = measuredH ?? ESTIMATED_POPOVER_H;

  // Prefer below; flip above when below is cramped and above has more room.
  const placeBelow = spaceBelow >= needed || spaceBelow >= spaceAbove;
  if (placeBelow) {
    return {
      top: rect.bottom + GAP,
      left,
      maxHeight: Math.max(120, spaceBelow),
    };
  }
  const maxHeight = Math.max(120, spaceAbove);
  const popH = Math.min(needed, maxHeight);
  return {
    top: Math.max(VIEWPORT_MARGIN, rect.top - GAP - popH),
    left,
    maxHeight,
  };
}

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
  const [pos, setPos] = useState<Pos | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const measuredH = popoverRef.current?.offsetHeight ?? null;
      setPos(computePos(btn, measuredH));
    };
    // One extra tick once the popover has rendered so we can use its real
    // height instead of the estimated one — handles tall breakdowns.
    const id = requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    if (next) {
      const btn = btnRef.current;
      if (btn) setPos(computePos(btn, null));
    }
    setOpen(next);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="focus-visible:ring-primary inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:outline-none"
        aria-expanded={open}
        aria-label={label ?? "Ver desglose de puntos"}
      >
        <span className="font-oswald">{pointsTotal} pts</span>
        <Info className="h-3 w-3 text-zinc-400" aria-hidden="true" />
      </button>
      {mounted &&
        open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            className="fixed z-50 w-96 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 bg-white p-4 text-left text-sm shadow-2xl"
            style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
