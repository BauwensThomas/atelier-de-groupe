"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as Y from "yjs";

type HeaderField = "title" | "authors";

type FieldProps = {
  onEdited?: () => void;
  ytext: Y.Text;
  placeholder: string;
  label: string;
  editable: boolean;
  maxLength: number;
  className: string;
};

// Champ texte relié à un Y.Text : les frappes simultanées fusionnent sans perte.
function SyncedField({ ytext, placeholder, label, editable, maxLength, className, onEdited }: FieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(() => ytext.toString());
  const pendingSelection = useRef<[number, number] | null>(null);

  useEffect(() => {
    const onChange = (event: Y.YTextEvent) => {
      if (event.transaction.local) return;
      const el = ref.current;
      if (el && document.activeElement === el) {
        // Décale notre curseur selon ce que l'autre a inséré ou supprimé avant lui.
        let start = el.selectionStart;
        let end = el.selectionEnd;
        let index = 0;
        for (const op of event.delta) {
          if (op.retain) index += op.retain;
          else if (typeof op.insert === "string") {
            const n = op.insert.length;
            if (index < start) start += n;
            if (index < end) end += n;
            index += n;
          } else if (op.delete) {
            const n = op.delete;
            if (index < start) start -= Math.min(n, start - index);
            if (index < end) end -= Math.min(n, end - index);
          }
        }
        pendingSelection.current = [start, end];
      }
      setValue(ytext.toString());
    };
    ytext.observe(onChange);
    setValue(ytext.toString());
    return () => ytext.unobserve(onChange);
  }, [ytext]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (pendingSelection.current) {
      el.setSelectionRange(...pendingSelection.current);
      pendingSelection.current = null;
    }
  }, [value]);

  function onInput(next: string) {
    const clean = next.replace(/[\r\n]+/g, " ").slice(0, maxLength);
    const prev = ytext.toString();
    let start = 0;
    while (start < prev.length && start < clean.length && prev[start] === clean[start]) start++;
    let endPrev = prev.length;
    let endNext = clean.length;
    while (endPrev > start && endNext > start && prev[endPrev - 1] === clean[endNext - 1]) {
      endPrev--;
      endNext--;
    }
    ytext.doc?.transact(() => {
      if (endPrev > start) ytext.delete(start, endPrev - start);
      if (endNext > start) ytext.insert(start, clean.slice(start, endNext));
    });
    setValue(clean);
    onEdited?.();
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      readOnly={!editable}
      placeholder={placeholder}
      aria-label={label}
      spellCheck
      onChange={(e) => onInput(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      className={`block w-full resize-none overflow-hidden bg-transparent text-center text-black outline-none placeholder:text-neutral-300 ${className}`}
    />
  );
}

export type LegendItem = { name: string; color: string; label: string };
type HeaderProps = { doc: Y.Doc; editable: boolean; onEdited?: (field: HeaderField) => void; legend?: LegendItem[] };

export function DocHeader({ doc, editable, onEdited, legend = [] }: HeaderProps) {
  return (
    <header className="mb-8 border-b border-neutral-200 pb-5">
      <SyncedField
        ytext={doc.getText("title")}
        label="Titre du projet"
        placeholder="Titre du projet"
        editable={editable}
        maxLength={200}
        onEdited={() => onEdited?.("title")}
        className="text-[1.9em] font-bold leading-tight"
      />
      {/* Auteurs : les membres du groupe, chacun avec son carré et son prénom dans sa couleur.
          À l'impression "Tout en noir" : prénoms en noir, sans carrés. */}
      <p className="author-legend mt-2 flex flex-wrap items-center justify-center gap-x-3 text-base leading-6">
        <span>Auteurs :</span>
        {legend.map((a, i) => (
          <span key={a.name} className="inline-flex items-center gap-1.5">
            <span className="author-square h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: a.color }} aria-hidden />
            <span className="author-name" style={{ color: a.color }}>
              {a.name}
              <span className="author-comma">{i < legend.length - 1 ? "," : ""}</span>
            </span>
          </span>
        ))}
      </p>
    </header>
  );
}
