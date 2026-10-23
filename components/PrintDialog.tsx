"use client";

import { useEffect, useState } from "react";
import type { Sheet } from "@/lib/sheets";
import { FileDown, Palette, Printer, Type } from "lucide-react";

export type ColorMode = "color" | "black";

/** Options d'export : afficher sous chaque question la personne qui doit répondre. */
export type ExportOptions = { assignees: boolean };

/** Lance l'impression dans le mode choisi (la feuille d'impression lit les classes "print-black"
 *  et "print-no-assignee"). */
export function printWithMode(mode: ColorMode, options: ExportOptions = { assignees: true }) {
  document.body.classList.toggle("print-black", mode === "black");
  document.body.classList.toggle("print-no-assignee", !options.assignees);
  const cleanup = () => {
    document.body.classList.remove("print-black", "print-no-assignee");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Laisse la fenêtre de choix se fermer avant d'ouvrir l'impression.
  setTimeout(() => window.print(), 50);
}

type Props = {
  kind: "print" | "word";
  /** sheetIds : feuilles à inclure, dans l'ordre des onglets. */
  onChoose: (mode: ColorMode, sheetIds: string[], options: ExportOptions) => void;
  onClose: () => void;
  /** Feuilles du projet (dans l'ordre des onglets). */
  sheets?: Sheet[];
};

// Choix avant export : texte en couleur des auteurs (qui a écrit quoi) ou tout en noir.
export function ExportChoiceDialog({ kind, onChoose, onClose, sheets = [] }: Props) {
  // Feuilles à inclure : toutes au départ.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(sheets.map((s) => s.id)));
  const all = sheets.length > 0 && selected.size === sheets.length;
  const [assignees, setAssignees] = useState(true);
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function choose(mode: ColorMode) {
    if (sheets.length && !selected.size) return;
    onClose();
    onChoose(mode, sheets.filter((s) => selected.has(s.id)).map((s) => s.id), { assignees });
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
        {sheets.length > 1 && (
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-sm text-neutral-600">Feuilles à inclure (dans l&apos;ordre des onglets) :</legend>
            <label className="flex items-center gap-2 py-0.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={all}
                onChange={() => setSelected(all ? new Set() : new Set(sheets.map((s) => s.id)))}
                className="h-4 w-4 accent-neutral-900"
              />
              Toutes les feuilles
            </label>
            <div className="ml-6 flex flex-col">
              {sheets.map((s) => (
                <label key={s.id} className="flex items-center gap-2 py-0.5 text-sm">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-neutral-900" />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
            {selected.size > 1 && <p className="mt-1 text-xs text-neutral-500">Un seul fichier : chaque feuille commence sur une nouvelle page, les numéros de page continuent.</p>}
            {!selected.size && <p className="mt-1 text-xs text-red-700">Choisis au moins une feuille.</p>}
          </fieldset>
        )}
        <label className="mb-4 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={assignees} onChange={(e) => setAssignees(e.target.checked)} className="mt-0.5 h-4 w-4 accent-neutral-900" />
          <span>
            Afficher qui répond aux questions
            <span className="block text-xs text-neutral-500">Le prénom choisi dans « Qui répond ? », à droite de la date de la question.</span>
          </span>
        </label>
        <p className="mb-4 text-sm text-neutral-600">Comment afficher le texte ?</p>
        <div className="flex flex-col gap-2">
          <button type="button" autoFocus disabled={sheets.length > 0 && !selected.size} onClick={() => choose("color")} className={`${option} disabled:opacity-40`}>
            <Palette size={18} className="mt-0.5 shrink-0 text-blue-600" aria-hidden />
            <span>
              <span className="block text-sm font-medium">En couleur</span>
              <span className="block text-xs text-neutral-500">Chaque texte dans la couleur de son auteur, pour voir qui a écrit quoi.</span>
            </span>
          </button>
          <button type="button" disabled={sheets.length > 0 && !selected.size} onClick={() => choose("black")} className={`${option} disabled:opacity-40`}>
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
