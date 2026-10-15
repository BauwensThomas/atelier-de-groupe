"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { MAIN_SHEET, SHEET_NAME_MAX, type Sheet } from "@/lib/sheets";

type Props = {
  sheets: Sheet[];
  current: string;
  editable: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (sheet: Sheet, name: string) => void;
  onDelete: (sheet: Sheet) => void;
  /** Déplace l'onglet à cette place (0 = premier). */
  onMove: (sheet: Sheet, toIndex: number) => void;
};

// Onglets des feuilles du projet, au-dessus de la barre d'outils.
export function SheetTabs({ sheets, current, editable, onSelect, onAdd, onRename, onDelete, onMove }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Glisser-déposer : onglet déplacé, et place où il arriverait (le trait bleu).
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  function drop() {
    const moved = sheets.find((s) => s.id === dragging);
    if (moved && dropAt !== null) {
      const from = sheets.indexOf(moved);
      // La place compte sans l'onglet déplacé.
      const to = dropAt > from ? dropAt - 1 : dropAt;
      if (to !== from) onMove(moved, to);
    }
    setDragging(null);
    setDropAt(null);
  }

  return (
    <div className="no-print flex items-end gap-1 overflow-x-auto rounded-t-xl border-b border-neutral-200 bg-neutral-100 px-2 pt-1.5" role="tablist" aria-label="Feuilles du projet">
      {sheets.map((sheet, index) => {
        const active = sheet.id === current;
        if (renaming === sheet.id) {
          return (
            <form
              key={sheet.id}
              className="flex shrink-0 items-center rounded-t-md bg-white px-1.5 py-1 ring-1 ring-neutral-200"
              onSubmit={(e) => {
                e.preventDefault();
                onRename(sheet, draft);
                setRenaming(null);
              }}
            >
              <input
                autoFocus
                value={draft}
                maxLength={SHEET_NAME_MAX}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  onRename(sheet, draft);
                  setRenaming(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setRenaming(null);
                }}
                aria-label="Nom de la feuille"
                className="w-40 rounded px-1 text-sm outline-none ring-1 ring-neutral-300 focus:ring-neutral-900"
              />
            </form>
          );
        }
        return (
          <div
            key={sheet.id}
            draggable={editable}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", sheet.id);
              setDragging(sheet.id);
            }}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              const box = e.currentTarget.getBoundingClientRect();
              setDropAt(e.clientX < box.left + box.width / 2 ? index : index + 1);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop();
            }}
            onDragEnd={() => {
              setDragging(null);
              setDropAt(null);
            }}
            title={editable ? "Glisser pour changer l'ordre des feuilles" : undefined}
            className={`group relative flex shrink-0 items-center rounded-t-md text-sm ${
              active ? "bg-white font-medium text-neutral-900 ring-1 ring-neutral-200" : "text-neutral-600 hover:bg-white/60"
            } ${dragging === sheet.id ? "opacity-40" : ""} ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            {/* Trait bleu : l'onglet déplacé arriverait ici */}
            {dragging && dropAt === index && <span className="absolute top-1 bottom-0 -left-1 w-0.5 rounded bg-sky-600" aria-hidden />}
            {dragging && dropAt === sheets.length && index === sheets.length - 1 && (
              <span className="absolute top-1 bottom-0 -right-1 w-0.5 rounded bg-sky-600" aria-hidden />
            )}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(sheet.id)}
              onDoubleClick={() => {
                if (!editable) return;
                setDraft(sheet.name);
                setRenaming(sheet.id);
              }}
              title={editable ? `${sheet.name} (double-clic pour renommer)` : sheet.name}
              className="flex max-w-56 items-center gap-1.5 px-3 py-1.5"
            >
              <FileText size={14} className="shrink-0" aria-hidden />
              <span className="truncate">{sheet.name}</span>
            </button>
            {active && editable && (
              <span className="flex items-center pr-1">
                {sheets.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => onMove(sheet, index - 1)}
                      title="Déplacer vers la gauche"
                      aria-label="Déplacer la feuille vers la gauche"
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                    >
                      <ChevronLeft size={12} aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={index === sheets.length - 1}
                      onClick={() => onMove(sheet, index + 1)}
                      title="Déplacer vers la droite"
                      aria-label="Déplacer la feuille vers la droite"
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                    >
                      <ChevronRight size={12} aria-hidden />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDraft(sheet.name);
                    setRenaming(sheet.id);
                  }}
                  title="Renommer la feuille"
                  aria-label="Renommer la feuille"
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <Pencil size={12} aria-hidden />
                </button>
                {sheet.id !== MAIN_SHEET && (
                  <button
                    type="button"
                    onClick={() => onDelete(sheet)}
                    title="Supprimer la feuille"
                    aria-label="Supprimer la feuille"
                    className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 size={12} aria-hidden />
                  </button>
                )}
              </span>
            )}
          </div>
        );
      })}
      {editable && (
        <button
          type="button"
          onClick={onAdd}
          className="mb-0.5 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-white hover:text-neutral-900"
        >
          <Plus size={14} aria-hidden />
          Nouvelle feuille
        </button>
      )}
    </div>
  );
}
