"use client";

import { useEffect, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";

/** Nombre de mots du document, sans le texte barré (il n'apparaît pas dans le rendu final). */
function countWords(editor: Editor): number {
  // Texte reconstitué bloc par bloc : un mot écrit à deux couleurs ("Bon" + "jour") compte pour un seul mot.
  let text = "";
  editor.state.doc.descendants((node) => {
    if (node.isBlock) text += " ";
    if (node.isText && node.text && !node.marks.some((m) => m.type.name === "deleted")) text += node.text;
    return true;
  });
  return text.split(/\s+/).filter(Boolean).length;
}

// Compteur "1 250 mots · 3 pages" (pages seulement quand la pagination est affichée, sur ordinateur).
export function DocStats({ editor }: { editor: Editor }) {
  const words = useEditorState({ editor, selector: ({ editor: e }) => countWords(e) });
  const [pages, setPages] = useState<number | null>(null);

  useEffect(() => {
    const dom = editor.view.dom;
    const update = () => {
      const paginated = dom.closest(".page")?.classList.contains("paginated");
      setPages(paginated ? dom.querySelectorAll(":scope > .page-break").length + 1 : null);
    };
    // Les sauts de page sont ajoutés et retirés par la pagination : on les observe.
    const observer = new MutationObserver(update);
    observer.observe(dom, { childList: true });
    update();
    return () => observer.disconnect();
  }, [editor]);

  const fmt = (n: number) => n.toLocaleString("fr-FR");
  return (
    <span className="ml-auto shrink-0 px-2 text-xs text-neutral-500 tabular-nums" aria-live="polite">
      {fmt(words)} mot{words > 1 ? "s" : ""}
      {pages !== null && (
        <>
          {" · "}
          {fmt(pages)} page{pages > 1 ? "s" : ""}
        </>
      )}
    </span>
  );
}
