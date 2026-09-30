"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, PowerOff } from "lucide-react";

// Déconnexion après 5 minutes sans activité, avec compte à rebours visible dès 15 secondes d'inactivité.
export const IDLE_LIMIT_MS = 5 * 60 * 1000;
const SHOW_AFTER_MS = 15 * 1000;
const EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart", "pointerdown"] as const;

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

type Props = {
  onIdle: () => void;
  onResume: () => void;
};

export function IdleGuard({ onIdle, onResume }: Props) {
  const lastActivity = useRef(0);
  const [idleFor, setIdleFor] = useState(0);
  const [disconnected, setDisconnected] = useState(false);
  const disconnectedRef = useRef(false);
  // Fonctions gardées dans des références : un nouveau rendu du parent ne relance pas le compteur.
  const onIdleRef = useRef(onIdle);
  const onResumeRef = useRef(onResume);
  useEffect(() => {
    onIdleRef.current = onIdle;
    onResumeRef.current = onResume;
  }, [onIdle, onResume]);

  const markActive = useCallback(() => {
    if (disconnectedRef.current) return;
    lastActivity.current = Date.now();
    setIdleFor((prev) => (prev === 0 ? prev : 0));
  }, []);

  useEffect(() => {
    lastActivity.current = Date.now();
    for (const name of EVENTS) window.addEventListener(name, markActive, { passive: true, capture: true });
    const timer = setInterval(() => {
      if (disconnectedRef.current) return;
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_LIMIT_MS) {
        disconnectedRef.current = true;
        setDisconnected(true);
        setIdleFor(0);
        onIdleRef.current();
      } else {
        setIdleFor(idle >= SHOW_AFTER_MS ? idle : 0);
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      for (const name of EVENTS) window.removeEventListener(name, markActive, { capture: true });
    };
  }, [markActive]);

  function resume() {
    disconnectedRef.current = false;
    setDisconnected(false);
    lastActivity.current = Date.now();
    onResumeRef.current();
  }

  if (disconnected) {
    return (
      <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4">
        <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
          <PowerOff size={26} className="mx-auto mb-3 text-neutral-500" aria-hidden />
          <h2 id="idle-title" className="font-semibold">
            Déconnecté
          </h2>
          <p className="mt-1 text-sm text-neutral-500">Tu as été déconnecté après 5 minutes sans activité.</p>
          <button
            type="button"
            autoFocus
            onClick={resume}
            className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Reprendre
          </button>
        </div>
      </div>
    );
  }

  if (!idleFor) return null;
  return (
    <div
      role="status"
      className="no-print fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white py-1.5 pr-1.5 pl-4 text-sm shadow-lg ring-1 ring-neutral-200"
    >
      <span className="text-neutral-600">
        Inactif : déconnexion dans <strong className="tabular-nums text-neutral-900">{format(IDLE_LIMIT_MS - idleFor)}</strong>
      </span>
      <button
        type="button"
        onClick={markActive}
        className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800"
      >
        <Hand size={13} aria-hidden />
        Je suis là
      </button>
    </div>
  );
}
