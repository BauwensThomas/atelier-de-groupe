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
import { ZoomBox } from "./ZoomBox";
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
  // Zoom de la page (retenu dans ce navigateur).
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem("gp.docZoom"));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved >= 0.5 && saved <= 2) setZoom(saved);
    } catch {
      // stockage indisponible : 100 %
    }
  }, []);
  // Page zoomée plus large que la zone : barre de défilement horizontale toujours visible en bas de l'écran
  // (celle du document lui-même est cachée, elle n'apparaîtrait qu'à la fin de la feuille).
  const area = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ scroll: 0, client: 0 });
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const update = () => setOverflow({ scroll: el.scrollWidth, client: el.clientWidth });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    update();
    return () => observer.disconnect();
  }, [zoom]);
  // Seulement quand on zoome au-dessus de 100 % et que la page dépasse vraiment (pas pour un pixel d'arrondi).
  const wide = zoom > 1 && overflow.scroll > overflow.client + 4;
  const syncing = useRef(false);
  function sync(from: HTMLDivElement | null, to: HTMLDivElement | null) {
    if (!from || !to || syncing.current) return;
    syncing.current = true;
    to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => (syncing.current = false));
  }

  function changeZoom(value: number) {
    setZoom(value);
    try {
      window.localStorage.setItem("gp.docZoom", String(value));
    } catch {
      // stockage indisponible
    }
  }

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
      {editor && <Toolbar editor={editor} zoom={zoom} onZoom={changeZoom} readOnly={readOnly} onComment={identity ? onComment : undefined} onUploadImage={readOnly ? undefined : onUploadImage} />}
      <div
        ref={area}
        onScroll={() => sync(area.current, bar.current)}
        className="print-reset no-scrollbar flex overflow-x-auto px-2 py-4 sm:px-6 sm:py-8"
        style={{ justifyContent: "safe center" }}
      >
        <ZoomBox zoom={zoom}>
          <div className="page" onMouseOver={onMouseOver} onMouseLeave={() => setTip(null)}>
            {showHeader && <DocHeader doc={provider.getYDoc()} editable={Boolean(identity) && !readOnly} onEdited={onHeaderEdited} />}
            <EditorContent editor={editor} />
          </div>
        </ZoomBox>
      </div>
      {wide && (
        <div
          ref={bar}
          onScroll={() => sync(bar.current, area.current)}
          className="no-print sticky bottom-0 z-10 overflow-x-auto overflow-y-hidden border-t border-neutral-200 bg-white/90 backdrop-blur"
          aria-hidden
        >
          <div style={{ width: overflow.scroll, height: 1 }} />
        </div>
      )}
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
