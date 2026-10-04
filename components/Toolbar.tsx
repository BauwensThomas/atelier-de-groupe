"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  BookOpen,
  Bold,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  MessageSquareText,
  Redo2,
  Rows3,
  Table as TableIcon,
  Trash2,
  Undo2,
  RotateCcw,
  Search,
  MessageSquarePlus,
  ImagePlus,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DocStats } from "./DocStats";
import { DOC_ZOOMS } from "./ZoomBox";
import { SearchBar } from "./SearchBar";
import { closeSearch } from "@/lib/editor/search";
import { IMAGE_SIZES, imageWidth, pickAndInsertImage } from "@/lib/editor/image";

type ButtonProps = {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  wide?: boolean;
};

function ToolButton({ label, onClick, active, disabled, children, wide }: ButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        wide ? "px-2.5" : "w-8"
      } ${active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"}`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />;
}

type Props = {
  editor: Editor;
  onComment?: () => void;
  onUploadImage?: (file: File) => Promise<string | null>;
  /** Professeur : seulement Rechercher et Commenter. */
  readOnly?: boolean;
  zoom: number;
  onZoom: (zoom: number) => void;
};

export function Toolbar({ editor, onComment, onUploadImage, readOnly = false, zoom, onZoom }: Props) {
  const zoomIndex = DOC_ZOOMS.indexOf(zoom) === -1 ? DOC_ZOOMS.indexOf(1) : DOC_ZOOMS.indexOf(zoom);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      editable: e.isEditable,
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      inTable: e.isActive("table"),
      inQuestion: e.isActive("question"),
      // Image sélectionnée (un clic dessus) et sa taille (null : taille d'origine).
      imageSelected: e.isActive("image"),
      imageSize: e.isActive("image") ? imageWidth(e.getAttributes("image").width) : null,
      struck: e.isActive("deleted") || (!e.state.selection.empty && !!e.schema.marks.deleted && e.state.doc.rangeHasMark(e.state.selection.from, e.state.selection.to, e.schema.marks.deleted)),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      hasSelection: !e.state.selection.empty,
    }),
  });

  const off = !state.editable;
  const [searching, setSearching] = useState(false);
  const [searchTick, setSearchTick] = useState(0);
  const commentRef = useRef<(() => void) | undefined>(undefined);
  const canComment = Boolean(onComment) && state.hasSelection;
  useEffect(() => {
    commentRef.current = canComment ? onComment : undefined;
  }, [canComment, onComment]);

  // Ctrl+F (Cmd+F sur Mac) ouvre notre recherche : celle du navigateur ne voit pas tout le document paginé.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearching(true);
        setSearchTick((t) => t + 1);
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "KeyM") {
        // Ctrl+Alt+M : commenter la sélection.
        e.preventDefault();
        commentRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const chain = () => editor.chain().focus();

  return (
    <div className="no-print flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-white/95 px-2 py-1.5 backdrop-blur">
      {!readOnly && (
      <>
      <ToolButton label="Titre 1" active={state.h1} disabled={off} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={17} aria-hidden />
      </ToolButton>
      <ToolButton label="Titre 2" active={state.h2} disabled={off} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={17} aria-hidden />
      </ToolButton>
      <ToolButton label="Titre 3" active={state.h3} disabled={off} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 size={17} aria-hidden />
      </ToolButton>
      <Separator />
      <ToolButton label="Gras" active={state.bold} disabled={off} onClick={() => chain().toggleBold().run()}>
        <Bold size={16} aria-hidden />
      </ToolButton>
      <ToolButton label="Italique" active={state.italic} disabled={off} onClick={() => chain().toggleItalic().run()}>
        <Italic size={16} aria-hidden />
      </ToolButton>
      <Separator />
      <ToolButton label="Liste à puces" active={state.bullet} disabled={off} onClick={() => chain().toggleBulletList().run()}>
        <List size={17} aria-hidden />
      </ToolButton>
      <ToolButton label="Liste numérotée" active={state.ordered} disabled={off} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered size={17} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Insérer un tableau"
        disabled={off || state.inTable || state.inQuestion}
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon size={16} aria-hidden />
      </ToolButton>
      {onUploadImage && (
        <ToolButton label="Insérer une image (ou coller, ou glisser)" disabled={off} onClick={() => pickAndInsertImage(editor.view, onUploadImage)}>
          <ImagePlus size={16} aria-hidden />
        </ToolButton>
      )}
      <Separator />
      <ToolButton
        label="Question (Ctrl+Alt+Q)"
        wide
        disabled={off}
        onClick={() => chain().toggleQuestion("question").run()}
      >
        <MessageSquareText size={16} aria-hidden />
        Question
      </ToolButton>
      <ToolButton
        label="Sujet (Ctrl+Alt+S)"
        wide
        disabled={off}
        onClick={() => chain().toggleQuestion("sujet").run()}
      >
        <BookOpen size={16} aria-hidden />
        Sujet
      </ToolButton>
      <Separator />
      <ToolButton
        label="Restaurer le texte barré"
        wide
        disabled={off || !state.struck}
        onClick={() => chain().unsetMark("deleted", { extendEmptyMarkRange: true }).run()}
      >
        <RotateCcw size={15} aria-hidden />
        Restaurer
      </ToolButton>
      </>
      )}
      <ToolButton label="Rechercher (Ctrl+F)" wide active={searching} onClick={() => {
          if (searching) closeSearch(editor);
          setSearching(!searching);
        }}>
        <Search size={15} aria-hidden />
        Rechercher
      </ToolButton>
      {onComment && (
        <ToolButton label="Commenter la sélection (Ctrl+Alt+M)" wide disabled={!canComment} onClick={onComment}>
          <MessageSquarePlus size={15} aria-hidden />
          Commenter
        </ToolButton>
      )}
      {!readOnly && (
      <>
      <Separator />
      <ToolButton label="Annuler" disabled={off || !state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 size={16} aria-hidden />
      </ToolButton>
      <ToolButton label="Rétablir" disabled={off || !state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 size={16} aria-hidden />
      </ToolButton>
      </>
      )}

      {state.imageSelected && !off && (
        <div className="flex w-full flex-wrap items-center gap-0.5 border-t border-neutral-100 pt-1 sm:ml-auto sm:w-auto sm:border-0 sm:pt-0">
          <span className="px-1.5 text-xs text-neutral-500">Taille :</span>
          {IMAGE_SIZES.map((s) => (
            <ToolButton
              key={s.value}
              label={`${s.label} (${s.value} %)`}
              wide
              active={state.imageSize === s.value}
              onClick={() => chain().updateAttributes("image", { width: s.value }).run()}
            >
              {s.label}
            </ToolButton>
          ))}
          <ToolButton label="Taille d'origine" wide active={state.imageSize === null} onClick={() => chain().updateAttributes("image", { width: null }).run()}>
            Origine
          </ToolButton>
        </div>
      )}

      {state.inTable && !off && (
        <div className="flex w-full flex-wrap items-center gap-0.5 border-t border-neutral-100 pt-1 sm:ml-auto sm:w-auto sm:border-0 sm:pt-0">
          <ToolButton label="Ajouter une ligne" wide onClick={() => chain().addRowAfter().run()}>
            <Rows3 size={15} aria-hidden />
            Ligne
          </ToolButton>
          <ToolButton label="Ajouter une colonne" wide onClick={() => chain().addColumnAfter().run()}>
            <Columns3 size={15} aria-hidden />
            Colonne
          </ToolButton>
          <ToolButton label="Supprimer la ligne" onClick={() => chain().deleteRow().run()}>
            <Rows3 size={15} className="text-red-600" aria-hidden />
          </ToolButton>
          <ToolButton label="Supprimer la colonne" onClick={() => chain().deleteColumn().run()}>
            <Columns3 size={15} className="text-red-600" aria-hidden />
          </ToolButton>
          <ToolButton label="Supprimer le tableau" onClick={() => chain().deleteTable().run()}>
            <Trash2 size={15} className="text-red-600" aria-hidden />
          </ToolButton>
        </div>
      )}

      <DocStats editor={editor} />

      {/* Zoom de la page (ordinateur) */}
      <div className="hidden items-center sm:flex" role="group" aria-label="Zoom de la page">
        <ToolButton label="Dézoomer la page" disabled={zoomIndex <= 0} onClick={() => onZoom(DOC_ZOOMS[zoomIndex - 1])}>
          <ZoomOut size={15} aria-hidden />
        </ToolButton>
        <button
          type="button"
          onClick={() => onZoom(1)}
          title="Revenir à 100 %"
          className="w-11 rounded-md py-1 text-center text-xs text-neutral-600 tabular-nums hover:bg-neutral-100"
        >
          {Math.round(zoom * 100)} %
        </button>
        <ToolButton label="Zoomer la page" disabled={zoomIndex >= DOC_ZOOMS.length - 1} onClick={() => onZoom(DOC_ZOOMS[zoomIndex + 1])}>
          <ZoomIn size={15} aria-hidden />
        </ToolButton>
      </div>

      {searching && <SearchBar key={searchTick} editor={editor} onClose={() => setSearching(false)} />}
    </div>
  );
}
