"use client";

import { useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import type { LiveblocksYjsProvider } from "@liveblocks/yjs";
import type { Identity } from "@/lib/identity";
import { AuthorMark } from "@/lib/editor/author-mark";
import { Question } from "@/lib/editor/question";
import { SafeDelete } from "@/lib/editor/safe-delete";
import { DeletedMark } from "@/lib/editor/track-deletions";
import { Pagination } from "@/lib/editor/pagination";
import { Search } from "@/lib/editor/search";
import { DocHeader } from "./DocHeader";
import { Toolbar } from "./Toolbar";

type Props = {
  provider: LiveblocksYjsProvider;
  identity: Identity | null;
  identityRef: RefObject<Identity | null>;
  onBlocked: () => void;
  onReady: (editor: TiptapEditor | null) => void;
  onHeaderEdited: (field: "title" | "authors") => void;
};

type Tip = { name: string; x: number; y: number } | null;

const GUEST = { name: "Invité", color: "#6b7280" };

export function Editor({ provider, identity, identityRef, onBlocked, onReady, onHeaderEdited }: Props) {
  const onBlockedRef = useRef(onBlocked);
  const [tip, setTip] = useState<Tip>(null);

  useEffect(() => {
    onBlockedRef.current = onBlocked;
  }, [onBlocked]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: Boolean(identityRef.current),
    extensions: [
      StarterKit.configure({
        undoRedo: false,
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
      }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: "Colle ici les questions, puis écris vos réponses." }),
      Collaboration.configure({ document: provider.getYDoc() }),
      CollaborationCaret.configure({
        provider,
        user: identityRef.current ?? GUEST,
      }),
      AuthorMark.configure({ getUser: () => identityRef.current }),
      DeletedMark.configure({ getUser: () => identityRef.current }),
      Question.configure({ onBlocked: () => onBlockedRef.current() }),
      SafeDelete,
      Pagination,
      Search,
    ],
    editorProps: {
      attributes: { spellcheck: "true", "aria-label": "Document du groupe" },
    },
  });

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  // Nouveau prénom ou nouvelle couleur : on met à jour le curseur et l'édition.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(Boolean(identity));
    editor.commands.updateUser(identity ?? GUEST);
  }, [editor, identity]);

  function onMouseOver(event: MouseEvent) {
    const el = event.target as HTMLElement;
    const target = el.closest<HTMLElement>("span[data-author]");
    const author = target?.getAttribute("data-author");
    const deletedBy = el.closest<HTMLElement>("span[data-deleted-by]")?.getAttribute("data-deleted-by");
    if (!target || !author) {
      if (tip) setTip(null);
      return;
    }
    const name = deletedBy ? `Écrit par ${author}, barré par ${deletedBy}` : author;
    const rect = target.getBoundingClientRect();
    setTip({ name, x: event.clientX, y: rect.top });
  }

  return (
    <div className="flex flex-col">
      {editor && <Toolbar editor={editor} />}
      <div className="print-reset flex justify-center px-2 py-4 sm:px-6 sm:py-8">
        <div className="page" onMouseOver={onMouseOver} onMouseLeave={() => setTip(null)}>
          <DocHeader doc={provider.getYDoc()} editable={Boolean(identity)} onEdited={onHeaderEdited} />
          <EditorContent editor={editor} />
        </div>
      </div>
      {tip && (
        <div
          role="tooltip"
          className="no-print pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white shadow"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          {tip.name}
        </div>
      )}
    </div>
  );
}
