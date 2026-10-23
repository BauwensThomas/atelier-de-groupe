"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Align } from "@/lib/editor/align";
import { Placeholder } from "@tiptap/extensions";
import type { JSONContent } from "@tiptap/core";
import type * as Y from "yjs";
import { yXmlFragmentToProsemirrorJSON } from "@tiptap/y-tiptap";
import { AuthorMark } from "@/lib/editor/author-mark";
import { DeletedMark } from "@/lib/editor/track-deletions";
import { Question } from "@/lib/editor/question";
import { DocImage } from "@/lib/editor/image";
import { Pagination, pageBreakIndices } from "@/lib/editor/pagination";
import { MAIN_SHEET, sheetField, type Sheet } from "@/lib/sheets";
import { DocHeader, type LegendItem } from "./DocHeader";

// Export de plusieurs feuilles : chaque feuille est affichée hors de l'écran, à la largeur A4 et découpée en
// pages comme à l'écran. L'impression (PDF) imprime ces pages à la suite ; Word reçoit leurs sauts de page.

export type RenderedSheet = { id: string; json: JSONContent; breaks: number[]; header: boolean };

function SheetEditor({ json, onEditor }: { json: JSONContent; onEditor: (editor: Editor) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    content: json,
    extensions: [
      StarterKit.configure({ undoRedo: false, heading: { levels: [1, 2, 3] }, code: false, codeBlock: false, blockquote: false, horizontalRule: false, strike: false, underline: false, link: false }),
      TableKit.configure({ table: { resizable: false, cellMinWidth: 40 } }),
      Align,
      // Lignes vides marquées (les dernières ne sont pas imprimées, comme pour le document affiché).
      Placeholder.configure({ placeholder: "", showOnlyCurrent: false, showOnlyWhenEditable: false }),
      AuthorMark,
      DeletedMark,
      Question,
      DocImage,
      Pagination,
    ],
  });
  useEffect(() => {
    if (editor) onEditor(editor);
  }, [editor, onEditor]);
  return <EditorContent editor={editor} />;
}

type Props = {
  doc: Y.Doc;
  sheets: Sheet[];
  legend: LegendItem[];
  /** Appelé quand toutes les feuilles sont affichées et découpées en pages. */
  onReady: (sheets: RenderedSheet[]) => void;
};

export function SheetsRender({ doc, sheets, legend, onReady }: Props) {
  // Contenu de chaque feuille au moment de l'export.
  const contents = useMemo(
    () => sheets.map((s) => ({ sheet: s, json: yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(sheetField(s.id))) as JSONContent })),
    [doc, sheets],
  );
  const editors = useRef(new Map<string, Editor>());
  const [ready, setReady] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (ready < contents.length || done.current) return;
    // Laisse le temps à la découpe en pages (polices, images) avant de lire les sauts de page.
    const timer = setTimeout(() => {
      done.current = true;
      onReady(
        contents.map(({ sheet, json }) => {
          const editor = editors.current.get(sheet.id);
          return { id: sheet.id, json, breaks: editor ? pageBreakIndices(editor.state) : [], header: sheet.id === MAIN_SHEET };
        }),
      );
    }, 1500);
    return () => clearTimeout(timer);
  }, [ready, contents, onReady]);

  return (
    <div className="sheets-render" aria-hidden>
      {contents.map(({ sheet, json }) => (
        <div key={sheet.id} className="sheet-render-item">
          <div className="page">
            {sheet.id === MAIN_SHEET && <DocHeader doc={doc} editable={false} legend={legend} />}
            <SheetEditor
              json={json}
              onEditor={(editor) => {
                if (editors.current.has(sheet.id)) return;
                editors.current.set(sheet.id, editor);
                setReady((n) => n + 1);
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
