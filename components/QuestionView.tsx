"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { Lock, LockOpen, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";

/** "2026-09-30" devient "30 septembre 2026". */
export function formatDate(iso: unknown): string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function QuestionView({ node, editor, getPos }: ReactNodeViewProps) {
  const locked = Boolean(node.attrs.locked);
  const isSubject = node.attrs.kind === "sujet";
  const label = isSubject ? "Sujet" : "Question";
  const date = typeof node.attrs.date === "string" ? node.attrs.date : "";

  // Empêche le clic de déplacer le curseur de l'éditeur avant l'action.
  const keepSelection = (event: MouseEvent) => event.preventDefault();

  function toggleLock() {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.chain().focus().setQuestionLocked(pos, !locked).run();
  }

  function changeDate(value: string) {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.commands.setQuestionDate(pos, value || null);
  }

  function remove() {
    const pos = getPos();
    if (typeof pos !== "number") return;
    const what = isSubject ? "ce sujet" : "cette question";
    if (!window.confirm(`Supprimer ${what} et son contenu ?`)) return;
    editor.chain().focus().deleteQuestion(pos).run();
  }

  return (
    <NodeViewWrapper
      className={`question-block${isSubject ? " subject-block" : ""}`}
      data-type="question"
      data-kind={node.attrs.kind}
      data-locked={locked}
    >
      <div className="question-header" contentEditable={false}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="question-label">{label}</span>
          {locked || !editor.isEditable ? (
            date && <span className="question-date">{formatDate(date)}</span>
          ) : (
            <input
              type="date"
              value={date}
              onChange={(e) => changeDate(e.target.value)}
              aria-label={`Date ${isSubject ? "du sujet" : "de la question"}`}
              className="question-date rounded border border-neutral-200 bg-white px-1 py-0"
            />
          )}
        </div>
        <div className="question-actions no-print ml-auto flex items-center gap-0.5">
          {!locked && (
            <button
              type="button"
              onMouseDown={keepSelection}
              onClick={remove}
              className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-red-700 hover:bg-red-50"
            >
              <Trash2 size={12} aria-hidden />
              {isSubject ? "Supprimer le sujet" : "Supprimer la question"}
            </button>
          )}
          <button
            type="button"
            onMouseDown={keepSelection}
            onClick={toggleLock}
            title={locked ? "Déverrouiller pour corriger" : "Verrouiller"}
            aria-label={locked ? `Déverrouiller ${isSubject ? "le sujet" : "la question"}` : "Verrouiller"}
            className={`rounded p-0.5 hover:bg-neutral-100 ${locked ? "text-neutral-400" : "text-amber-700"}`}
          >
            {locked ? <Lock size={12} aria-hidden /> : <LockOpen size={12} aria-hidden />}
          </button>
        </div>
      </div>
      <NodeViewContent className="question-content" />
    </NodeViewWrapper>
  );
}
