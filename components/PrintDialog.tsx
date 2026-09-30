"use client";

import { useEffect } from "react";
import { FileDown, Palette, Printer, Type } from "lucide-react";

export type ColorMode = "color" | "black";

/** Lance l'impression dans le mode choisi (la feuille d'impression lit la classe "print-black"). */
export function printWithMode(mode: ColorMode) {
  document.body.classList.toggle("print-black", mode === "black");
  const cleanup = () => {
    document.body.classList.remove("print-black");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Laisse la fenêtre de choix se fermer avant d'ouvrir l'impression.
  setTimeout(() => window.print(), 50);
}

type Props = {
  kind: "print" | "word";
  onChoose: (mode: ColorMode) => void;
  onClose: () => void;
};

// Choix avant export : texte en couleur des auteurs (qui a écrit quoi) ou tout en noir.
export function ExportChoiceDialog({ kind, onChoose, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function choose(mode: ColorMode) {
    onClose();
    onChoose(mode);
  }

  const option =
    "flex w-full items-start gap-3 rounded-lg p-3 text-left ring-1 ring-neutral-200 transition hover:bg-neutral-50 hover:ring-neutral-400";
  const Icon = kind === "word" ? FileDown : Printer;

  return (
    <div
      className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 id="export-title" className="mb-1 flex items-center gap-2 font-semibold">
          <Icon size={17} aria-hidden />
          {kind === "word" ? "Exporter en Word" : "Imprimer / PDF"}
        </h2>
        <p className="mb-4 text-sm text-neutral-600">Comment afficher le texte ?</p>
        <div className="flex flex-col gap-2">
          <button type="button" autoFocus onClick={() => choose("color")} className={option}>
            <Palette size={18} className="mt-0.5 shrink-0 text-blue-600" aria-hidden />
            <span>
              <span className="block text-sm font-medium">En couleur</span>
              <span className="block text-xs text-neutral-500">Chaque texte dans la couleur de son auteur, pour voir qui a écrit quoi.</span>
            </span>
          </button>
          <button type="button" onClick={() => choose("black")} className={option}>
            <Type size={18} className="mt-0.5 shrink-0 text-neutral-800" aria-hidden />
            <span>
              <span className="block text-sm font-medium">Tout en noir</span>
              <span className="block text-xs text-neutral-500">Version propre pour un rendu.</span>
            </span>
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
