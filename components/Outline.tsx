"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { FoldSection } from "./FoldSection";

type Entry = { kind: "sujet" | "question"; tag: string; text: string; pos: number; nested: boolean };

/** Première ligne non vide du bloc (sans le texte barré). */
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

/** Sujets et questions du document, dans l'ordre. Une question qui suit un sujet est décalée sous lui. */
function entries(editor: Editor): Entry[] {
  const out: Entry[] = [];
  let underSubject = false;
  let number = 0; // les questions sont numérotées, en repartant de 1 après chaque sujet
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "question") return true;
    const kind = node.attrs.kind === "sujet" ? "sujet" : "question";
    if (kind === "sujet") {
      underSubject = true;
      number = 0;
    } else {
      number++;
    }
    const tag = kind === "sujet" ? "Sujet" : `Q${number}`;
    out.push({ kind, tag, text: firstLine(node), pos, nested: kind === "question" && underSubject });
    return false;
  });
  return out;
}

// Sommaire automatique : un clic emmène au sujet ou à la question.
export function Outline({ editor }: { editor: Editor }) {
  const items = useEditorState({ editor, selector: ({ editor: e }) => entries(e) });

  function go(item: Entry) {
    const dom = editor.view.nodeDOM(item.pos);
    if (!(dom instanceof HTMLElement)) return;
    // Le cadre gris (qui porte la marge sous la barre d'outils) est à l'intérieur de la vue du bloc.
    const block = dom.matches(".question-block") ? dom : (dom.querySelector(".question-block") ?? dom);
    block.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <FoldSection id="outline" title="Sommaire" count={items.length}>
      {items.length ? (
        <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {items.map((item) => {
            return (
              <li key={item.pos} className={item.nested ? "ml-3" : ""}>
                <button
                  type="button"
                  onClick={() => go(item)}
                  title={item.text || (item.kind === "sujet" ? "Sujet vide" : "Question vide")}
                  className={`flex w-full items-baseline gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-neutral-100 ${
                    item.kind === "sujet" ? "font-medium" : ""
                  }`}
                >
                  <span
                    className={`shrink-0 text-[10px] font-semibold uppercase ${
                      item.kind === "sujet" ? "text-neutral-900" : "text-neutral-500"
                    }`}
                  >
                    {item.tag}
                  </span>
                  <span className={`truncate ${item.text ? "" : "text-neutral-400 italic"}`}>{item.text || "vide"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-neutral-500">Les sujets et les questions du document apparaissent ici.</p>
      )}
    </FoldSection>
  );
}
