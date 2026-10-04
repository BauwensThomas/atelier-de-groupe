"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { closeSearch, moveSearch, searchInfo, setSearchQuery } from "@/lib/editor/search";

// Ligne de recherche sous la barre d'outils : Entrée = suivant, Maj+Entrée = précédent, Échap = fermer.
export function SearchBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const info = useEditorState({ editor, selector: ({ editor: e }) => searchInfo(e.state) });
  const [value, setValue] = useState(info.query);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  function close() {
    closeSearch(editor);
    onClose();
  }

  const button = "flex h-7 w-7 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:opacity-40";

  return (
    <div className="flex w-full items-center gap-1 border-t border-neutral-100 pt-1">
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSearchQuery(editor, e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            moveSearch(editor, e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
        placeholder="Rechercher un mot"
        aria-label="Rechercher dans le document"
        className="h-7 min-w-0 flex-1 rounded-md px-2 text-sm ring-1 ring-neutral-300 outline-none focus:ring-2 focus:ring-neutral-900 sm:max-w-xs"
      />
      <span className="shrink-0 px-1 text-xs text-neutral-500 tabular-nums" role="status">
        {value.trim() ? (info.count ? `${info.current + 1} sur ${info.count}` : "Aucun résultat") : ""}
      </span>
      <button type="button" className={button} disabled={!info.count} onClick={() => moveSearch(editor, -1)} title="Précédent (Maj+Entrée)" aria-label="Résultat précédent">
        <ChevronUp size={16} aria-hidden />
      </button>
      <button type="button" className={button} disabled={!info.count} onClick={() => moveSearch(editor, 1)} title="Suivant (Entrée)" aria-label="Résultat suivant">
        <ChevronDown size={16} aria-hidden />
      </button>
      <button type="button" className={button} onClick={close} title="Fermer (Échap)" aria-label="Fermer la recherche">
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
