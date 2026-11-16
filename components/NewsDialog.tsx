"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

// "Quoi de neuf" : fenêtre au centre de l'écran avec les dernières nouveautés du site, montrée une seule fois.
// Après "OK", elle ne revient plus sur cet appareil. Pour l'afficher de nouveau à tout le monde, il suffit de
// changer NEWS_ID et la liste NEWS.

const NEWS_KEY = "gp.newsSeen";
const NEWS_ID = "2026-11-16";

const NEWS: Array<{ title: string; text: string }> = [
  {
    title: "Petites corrections",
    text: "Dans le texte d'un autre, une majuscule, un accent, une espace ou une ponctuation corrigés ne sont plus barrés : le texte garde la couleur de son auteur. L'activité note la correction.",
  },
  {
    title: "Pages",
    text: "Moins de marge en haut et en bas des pages, à l'écran, dans le PDF et dans Word.",
  },
  {
    title: "Demi-écran",
    text: "Fenêtre en demi-écran : le panneau reste sur le côté, comme sur grand écran. Replie-le pour avoir plus de place.",
  },
  {
    title: "Images",
    text: "Les images s'affichent en entier dans Word et dans le PDF.",
  },
];

function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(NEWS_KEY) === NEWS_ID;
  } catch {
    // Stockage indisponible (navigation privée...) : on ne gêne pas avec la fenêtre.
    return true;
  }
}

export function NewsDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Lu après l'affichage (le stockage du navigateur n'existe pas côté serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!alreadySeen());
  }, []);

  function close() {
    try {
      window.localStorage.setItem(NEWS_KEY, NEWS_ID);
    } catch {
      // rien à faire
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-85 flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="news-title" className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <h2 id="news-title" className="flex items-center gap-2 px-5 pt-5 pb-3 text-lg font-semibold">
          <Sparkles size={18} className="text-amber-500" aria-hidden />
          Quoi de neuf ?
        </h2>
        <ul className="flex flex-col gap-3 overflow-y-auto px-5 text-sm">
          {NEWS.map((item) => (
            <li key={item.title}>
              <p className="font-medium text-neutral-900">{item.title}</p>
              <p className="text-neutral-600">{item.text}</p>
            </li>
          ))}
        </ul>
        <p className="px-5 pt-3 text-xs text-neutral-500">
          Tout est expliqué dans le{" "}
          <a href="/aide" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-neutral-800">
            mode d&apos;emploi
          </a>
          .
        </p>
        <div className="flex justify-end p-5 pt-4">
          <button type="button" autoFocus onClick={close} className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
