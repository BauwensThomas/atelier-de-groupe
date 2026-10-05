"use client";

import { useEffect, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type * as Y from "yjs";
import { yXmlFragmentToProsemirrorJSON } from "@tiptap/y-tiptap";
import { sheetField, type Sheet } from "@/lib/sheets";
import { FoldSection } from "./FoldSection";

// Sommaire de toutes les feuilles : leurs sujets et leurs questions. Un clic emmène au bloc, en changeant de
// feuille si besoin.

type Entry = { kind: "sujet" | "question"; tag: string; text: string; index: number; nested: boolean };

/** Sujets et questions, dans l'ordre. index : rang du bloc parmi les questions et sujets de la feuille. */
function collect(blocks: Array<{ kind: "sujet" | "question"; text: string }>): Entry[] {
  const out: Entry[] = [];
  let underSubject = false;
  let number = 0; // les questions sont numérotées, en repartant de 1 après chaque sujet
  blocks.forEach((b, index) => {
    if (b.kind === "sujet") {
      underSubject = true;
      number = 0;
    } else {
      number++;
    }
    out.push({ kind: b.kind, tag: b.kind === "sujet" ? "Sujet" : `Q${number}`, text: b.text, index, nested: b.kind === "question" && underSubject });
  });
  return out;
}

/** Première ligne non vide du bloc (sans le texte barré), depuis l'éditeur. */
function firstLine(block: PMNode): string {
  let line = "";
  block.descendants((node) => {
    if (line) return false;
    if (!node.isTextblock) return true;
    let text = "";
    node.forEach((child) => {
      if (child.isText && !child.marks.some((m) => m.type.name === "deleted")) text += child.text;
    });
    line = text.trim();
    return false;
  });
  return line;
}

function fromEditor(editor: Editor): Entry[] {
  const blocks: Array<{ kind: "sujet" | "question"; text: string }> = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "question") return true;
    blocks.push({ kind: node.attrs.kind === "sujet" ? "sujet" : "question", text: firstLine(node) });
    return false;
  });
  return collect(blocks);
}

/** Même chose depuis le texte enregistré d'une feuille qui n'est pas affichée. */
function fromJson(doc: JSONContent): Entry[] {
  const blocks: Array<{ kind: "sujet" | "question"; text: string }> = [];
  const lineOf = (node: JSONContent): string => {
    if (node.content?.some((c) => c.type === "text")) {
      return (node.content ?? [])
        .filter((c) => c.type === "text" && !(c.marks ?? []).some((m) => m.type === "deleted"))
        .map((c) => c.text ?? "")
        .join("")
        .trim();
    }
    for (const child of node.content ?? []) {
      const line = lineOf(child);
      if (line) return line;
    }
    return "";
  };
  const walk = (node: JSONContent) => {
    if (node.type === "question") {
      blocks.push({ kind: node.attrs?.kind === "sujet" ? "sujet" : "question", text: lineOf(node) });
      return;
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return collect(blocks);
}

/** Sommaires des feuilles non affichées, mis à jour quand le document change. */
function useOtherSheets(doc: Y.Doc | undefined, sheets: Sheet[], current: string): Record<string, Entry[]> {
  const [map, setMap] = useState<Record<string, Entry[]>>({});
  const key = sheets.map((s) => s.id).join(",");
  useEffect(() => {
    if (!doc) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const compute = () => {
      const next: Record<string, Entry[]> = {};
      for (const s of sheets) {
        if (s.id === current) continue;
        try {
          next[s.id] = fromJson(yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(sheetField(s.id))));
        } catch {
          next[s.id] = [];
        }
      }
      setMap(next);
    };
    const onUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(compute, 500);
    };
    compute();
    doc.on("update", onUpdate);
    return () => {
      clearTimeout(timer);
      doc.off("update", onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, key, current]);
  return map;
}

type Props = {
  editor: Editor;
  doc: Y.Doc;
  sheets: Sheet[];
  current: string;
  /** Aller au n-ième sujet ou question d'une autre feuille. */
  onGo: (sheet: string, index: number) => void;
};

// Valeurs par défaut : le sommaire reste affichable même si une information manque un instant
// (par exemple pendant un rechargement du code en développement).
export function Outline({ editor, doc, sheets = [], current, onGo }: Props) {
  const here = useEditorState({ editor, selector: ({ editor: e }) => fromEditor(e) });
  const others = useOtherSheets(doc, sheets, current);
  // Toujours au moins la feuille affichée.
  const list = sheets.length ? sheets : [{ id: current, name: "", t: 0 }];
  const groups = list.map((s) => ({ sheet: s, items: s.id === current ? here : (others[s.id] ?? []) }));
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  function go(sheet: string, item: Entry) {
    if (sheet !== current) return onGo(sheet, item.index);
    const block = editor.view.dom.querySelectorAll<HTMLElement>(".question-block")[item.index];
    block?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <FoldSection id="outline" title="Sommaire" count={total}>
      {total ? (
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {groups.map(({ sheet, items }) =>
            sheets.length > 1 || items.length ? (
              <div key={sheet.id}>
                {sheets.length > 1 && (
                  <p className={`mb-0.5 truncate px-1.5 text-[11px] font-semibold ${sheet.id === current ? "text-neutral-900" : "text-neutral-500"}`}>
                    {sheet.name}
                  </p>
                )}
                {items.length ? (
                  <ul className="flex flex-col gap-0.5">
                    {items.map((item) => (
                      <li key={item.index} className={item.nested ? "ml-3" : ""}>
                        <button
                          type="button"
                          onClick={() => go(sheet.id, item)}
                          title={item.text || (item.kind === "sujet" ? "Sujet vide" : "Question vide")}
                          className={`flex w-full items-baseline gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-neutral-100 ${
                            item.kind === "sujet" ? "font-medium" : ""
                          }`}
                        >
                          <span className={`shrink-0 text-[10px] font-semibold uppercase ${item.kind === "sujet" ? "text-neutral-900" : "text-neutral-500"}`}>
                            {item.tag}
                          </span>
                          <span className={`truncate ${item.text ? "" : "text-neutral-400 italic"}`}>{item.text || "vide"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-1.5 text-[11px] text-neutral-400 italic">Ni sujet ni question.</p>
                )}
              </div>
            ) : null,
          )}
        </div>
      ) : (
        <p className="text-xs text-neutral-500">Les sujets et les questions de toutes les feuilles apparaissent ici.</p>
      )}
    </FoldSection>
  );
}
