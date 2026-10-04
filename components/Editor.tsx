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
import { Comments } from "@/lib/editor/comments";
import { ReadOnlyGuard } from "@/lib/editor/read-only";
import { DocImage } from "@/lib/editor/image";
import { DocHeader } from "./DocHeader";
import { Toolbar } from "./Toolbar";

type Props = {
  provider: LiveblocksYjsProvider;
  identity: Identity | null;
  identityRef: RefObject<Identity | null>;
  onBlocked: () => void;
  onReady: (editor: TiptapEditor | null) => void;
  onHeaderEdited: (field: "title" | "authors") => void;
  /** Professeur : lecture seule (il peut seulement commenter). */
  readOnly: boolean;
  onOpenThread: (id: string) => void;
  /** Absent tant que les commentaires ne sont pas chargés. */
  onComment?: () => void;
  /** Envoi d'une image ; absent si les images ne sont pas possibles (professeur). */
  onUploadImage?: (file: File) => Promise<string | null>;
  /** Texte Yjs de la feuille affichée. */
  field: string;
  /** Titre et auteurs : seulement sur la feuille principale. */
  showHeader: boolean;
};

type Tip = { name: string; x: number; y: number } | null;

const GUEST = { name: "Invité", color: "#6b7280" };

export function Editor({ provider, identity, identityRef, onBlocked, onReady, onHeaderEdited, readOnly, onOpenThread, onComment, onUploadImage, field, showHeader }: Props) {
  const onBlockedRef = useRef(onBlocked);
  const onOpenThreadRef = useRef(onOpenThread);
  const uploadRef = useRef(onUploadImage);
  const [tip, setTip] = useState<Tip>(null);

  useEffect(() => {
    onBlockedRef.current = onBlocked;
    onOpenThreadRef.current = onOpenThread;
    uploadRef.current = onUploadImage;
  }, [onBlocked, onOpenThread, onUploadImage]);

  // L'éditeur est créé une seule fois : il lit l'identité et le mode à sa création, puis les fonctions
  // ci-dessous (getUser, onBlocked…) ne lisent les refs que pendant l'édition, jamais pendant l'affichage.
  /* eslint-disable react-hooks/refs */
  const editor = useEditor({
    immediatelyRender: false,
    editable: Boolean(identityRef.current) && !readOnly,
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
      Collaboration.configure({ document: provider.getYDoc(), field }),
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
      ReadOnlyGuard,
      DocImage.configure({ upload: (file) => uploadRef.current?.(file) ?? Promise.resolve(null) }),
      Comments.configure({ onOpen: (id) => onOpenThreadRef.current(id) }),
    ],
    editorProps: {
      attributes: { spellcheck: "true", "aria-label": "Document du groupe" },
    },
  });
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  // Nouveau prénom ou nouvelle couleur : on met à jour le curseur et l'édition.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(Boolean(identity) && !readOnly);
    editor.commands.updateUser(identity ?? GUEST);
  }, [editor, identity, readOnly]);

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
      {editor && <Toolbar editor={editor} readOnly={readOnly} onComment={identity ? onComment : undefined} onUploadImage={readOnly ? undefined : onUploadImage} />}
      <div className="print-reset flex justify-center px-2 py-4 sm:px-6 sm:py-8">
        <div className="page" onMouseOver={onMouseOver} onMouseLeave={() => setTip(null)}>
          {showHeader && <DocHeader doc={provider.getYDoc()} editable={Boolean(identity) && !readOnly} onEdited={onHeaderEdited} />}
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
