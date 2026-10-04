"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Bouton du panneau replié qui ouvre une petite fenêtre à sa gauche (fixée à l'écran : le panneau
// a sa propre barre de défilement et la couperait sinon). Se ferme au clic ailleurs ou avec Échap.
export function Flyout({
  label,
  icon,
  badge,
  title,
  children,
}: {
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
  title: string;
  children: (close: () => void) => ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setPos(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPos(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => {
          if (pos) return setPos(null);
          const rect = button.current?.getBoundingClientRect();
          if (rect) setPos({ top: Math.min(rect.top, window.innerHeight - 360), right: window.innerWidth - rect.left + 8 });
        }}
        title={label}
        aria-label={label}
        aria-expanded={Boolean(pos)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 ${pos ? "bg-neutral-100" : ""}`}
      >
        {icon}
        {badge}
      </button>
      {pos && (
        <div
          ref={panel}
          role="dialog"
          aria-label={title}
          className="fixed z-50 flex max-h-[340px] w-72 flex-col overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-neutral-200"
          style={{ top: Math.max(8, pos.top), right: pos.right }}
        >
          <p className="border-b border-neutral-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">{children(close)}</div>
        </div>
      )}
    </>
  );
}
