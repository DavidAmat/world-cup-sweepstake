"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { MonitorSmartphone, Wifi, ShieldAlert, X, Download, Skull } from "lucide-react";

/**
 * The "scam" prank shown to accounts flagged is_scam. Pure client-side theatre,
 * paced deliberately:
 *   - 3 small, mild notices fade in one at a time, every 5 s (subtle at first —
 *     not obviously a scam). Closing one brings it back a few seconds later.
 *   - At 30 s a calm "update available" dialog appears with an "Actualizar ahora"
 *     button.
 *   - Clicking it drops the scary full-screen "amenaza detectada" warning.
 * No navigation, no data writes — the form is disabled and an invisible layer
 * keeps every click away from it.
 */

type Toast = {
  id: string;
  icon: LucideIcon;
  /** Tailwind text-color for the small icon. */
  tone: string;
  title: string;
  body: string;
  /** Tailwind positioning classes — scattered around the viewport. */
  pos: string;
};

// Deliberately mild and a little ambiguous at the start.
const TOASTS: Toast[] = [
  {
    id: "system",
    icon: MonitorSmartphone,
    tone: "text-amber-500",
    title: "Actualización de la app",
    body: "El firmware de su Windows está bloqueando esta aplicación, por favor actualice la app para resolver el DDoS.",
    pos: "right-4 bottom-6 sm:right-6",
  },
  {
    id: "wifi",
    icon: Wifi,
    tone: "text-zinc-400",
    title: "Conflicto de IPs",
    body: "Hemos detectado un conflicto de IPs con la app de Mediolanum de su Windows, por favor actualice la app para resolver el proxy del firewall.",
    pos: "left-4 bottom-24 sm:left-6",
  },
  {
    id: "browser",
    icon: ShieldAlert,
    tone: "text-amber-500",
    title: "Compatibilidad del navegador",
    body: "Tras varios intentos de cargar la página, su navegador ha bloqueado la aplicación por seguridad. Estamos cargando la nueva versión de la app, espere unos segundos.",
    pos: "right-6 top-24 sm:right-10",
  },
];

const MAX_TOASTS = 3;
const REVEAL_INTERVAL_MS = 5000; // one notice every 5 s
const UPDATE_DELAY_MS = 30000; // "update" dialog after 30 s
const REAPPEAR_MS = 6000; // a closed notice comes back

function Notice({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = toast.icon;
  return (
    <div
      role="status"
      className={`fixed z-[70] w-60 max-w-[80vw] rounded-lg border border-zinc-200 bg-white/95 p-2.5 shadow-md backdrop-blur ${toast.pos}`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toast.tone}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-zinc-700">{toast.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{toast.body}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ScamExperience() {
  // How many notices have been revealed so far (0 → MAX_TOASTS, one per 5 s).
  const [revealed, setRevealed] = useState(0);
  // Notices the user closed; each is scheduled to reappear.
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showUpdate, setShowUpdate] = useState(false);
  const [virus, setVirus] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const captured = timers.current;

    const interval = window.setInterval(() => {
      setRevealed((n) => {
        if (n + 1 >= MAX_TOASTS) window.clearInterval(interval);
        return Math.min(n + 1, MAX_TOASTS);
      });
    }, REVEAL_INTERVAL_MS);

    const updateTimer = window.setTimeout(() => setShowUpdate(true), UPDATE_DELAY_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(updateTimer);
      captured.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  function closeToast(id: string) {
    setHidden((h) => ({ ...h, [id]: true }));
    const handle = window.setTimeout(() => {
      setHidden((h) => ({ ...h, [id]: false }));
    }, REAPPEAR_MS);
    timers.current.push(handle);
  }

  return (
    <>
      {/* Invisible blocker over the whole screen so nothing reaches the form. */}
      <div className="fixed inset-0 z-[60] cursor-not-allowed" aria-hidden />

      {TOASTS.slice(0, MAX_TOASTS).map((t, i) =>
        i < revealed && !hidden[t.id] ? (
          <Notice key={t.id} toast={t} onClose={() => closeToast(t.id)} />
        ) : null,
      )}

      {/* Calm "update available" dialog — appears after 30 s. */}
      {showUpdate && (
        <div className="fixed top-1/2 left-1/2 z-[75] w-80 max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl">
          <div className="flex items-center gap-2">
            <Download className="text-primary h-5 w-5" aria-hidden />
            <p className="text-base font-bold text-zinc-800">Actualización disponible</p>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Hay una nueva versión de la aplicación. Actualiza ahora para poder continuar y cambiar
            tu contraseña.
          </p>
          <button
            type="button"
            onClick={() => setVirus(true)}
            className="bg-primary text-primary-fg mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            Actualizar ahora
          </button>
        </div>
      )}

      {/* Full-screen threat warning triggered by the update button. */}
      {virus && (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-red-900/95 p-6 text-center text-white">
          <Skull className="h-20 w-20 animate-bounce text-white" aria-hidden />
          <h2 className="mt-6 text-3xl font-black tracking-tight">🚨 AMENAZA DETECTADA</h2>
          <p className="mt-4 max-w-md text-lg font-semibold">
            Se ha detectado un posible virus en tu equipo. Es muy probable que estés sufriendo un
            ciberataque.
          </p>
          <p className="mt-3 max-w-md text-base">
            Apaga el ordenador inmediatamente y contacta con el administrador del sistema. No
            introduzcas ninguna contraseña ni dato bancario.
          </p>
          <p className="mt-6 animate-pulse text-sm font-bold tracking-widest uppercase">
            Conexión comprometida · No cierres esta ventana
          </p>
        </div>
      )}
    </>
  );
}
