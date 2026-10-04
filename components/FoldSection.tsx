"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// Carte du panneau qu'on ouvre ou ferme d'un clic sur son titre. Fermée par défaut ;
// le choix est retenu sur cet ordinateur.
type Props = { id: string; title: string; count?: number; /** Petit signal visible même fermé (ex. : "2 pour toi"). */ alert?: string; children: ReactNode };

export function FoldSection({ id, title, count, alert, children }: Props) {
  const storageKey = `gp.fold.${id}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // stockage indisponible : la carte reste fermée
    }
  }, [storageKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // stockage indisponible : le choix vaut pour cette page seulement
    }
  }

  return (
    <section className="rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-center gap-1 rounded-lg p-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-800"
        >
          <ChevronRight size={14} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
          {title}
          {count !== undefined && count > 0 && <span className="font-normal normal-case text-neutral-400">({count})</span>}
          {alert && (
            <span className="ml-auto rounded-full bg-sky-600 px-1.5 py-px text-[10px] font-semibold tracking-normal text-white normal-case">{alert}</span>
          )}
        </button>
      </h2>
      {open && <div className="-mt-1 px-3 pb-3">{children}</div>}
    </section>
  );
}
