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
} from "lucide-react";
import type { ReactNode } from "react";

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

export function Toolbar({ editor }: { editor: Editor }) {
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
      struck: e.isActive("deleted") || (!e.state.selection.empty && !!e.schema.marks.deleted && e.state.doc.rangeHasMark(e.state.selection.from, e.state.selection.to, e.schema.marks.deleted)),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const off = !state.editable;
  const chain = () => editor.chain().focus();

  return (
    <div className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-white/95 px-2 py-1.5 backdrop-blur">
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
      <Separator />
      <ToolButton label="Annuler" disabled={off || !state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 size={16} aria-hidden />
      </ToolButton>
      <ToolButton label="Rétablir" disabled={off || !state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 size={16} aria-hidden />
      </ToolButton>

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
    </div>
  );
}
