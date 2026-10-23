"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

// "Quoi de neuf" : fenêtre au centre de l'écran avec les dernières nouveautés du site, montrée une seule fois.
// Après "OK", elle ne revient plus sur cet appareil. Pour l'afficher de nouveau à tout le monde, il suffit de
// changer NEWS_ID et la liste NEWS.

const NEWS_KEY = "gp.newsSeen";
const NEWS_ID = "2026-10-23";

const NEWS: Array<{ title: string; text: string }> = [
  {
    title: "Bouton « Enregistrer »",
    text: "En haut à droite : rouge s'il reste des modifications à enregistrer, vert quand tout est enregistré. Ctrl+S fait la même chose. Une copie est aussi faite toute seule quand tu arrêtes d'écrire ou quand tu quittes la page.",
  },
  {
    title: "« Qui répond ? » et le V vert",
    text: "À droite de la date d'une question : choisis la personne qui doit y répondre, son prénom s'affiche dans sa couleur. Le V vert valide la réponse et verrouille son texte (reclique dessus pour la modifier).",
  },
  {
    title: "Tableaux et alignement",
    text: "Glisse la bordure d'une colonne pour l'élargir. Les boutons d'alignement centrent le texte ou le mettent à droite, aussi dans une case de tableau.",
  },
  {
    title: "Feuilles",
    text: "Glisse un onglet pour changer l'ordre des feuilles.",
  },
  {
    title: "PDF et Word",
    text: "Choisis les feuilles à inclure : un seul fichier, les numéros de page continuent. Tu peux aussi afficher ou non qui répond aux questions.",
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
    <div className="no-print fixed inset-0 z-[85] flex items-center justify-center bg-black/40 px-4">
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
