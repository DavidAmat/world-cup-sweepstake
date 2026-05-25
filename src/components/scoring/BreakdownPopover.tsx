"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const POPOVER_WIDTH = 384;

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

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
        <span className="font-mono">{pointsTotal} pts</span>
        <Info className="h-3 w-3 text-zinc-400" aria-hidden="true" />
      </button>
      {mounted &&
        open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            className="fixed z-50 w-96 rounded-lg border border-zinc-200 bg-white p-4 text-left text-sm shadow-2xl"
            style={{ top: pos.top, left: pos.left }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
