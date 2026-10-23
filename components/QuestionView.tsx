"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { Check, Lock, LockOpen, Trash2 } from "lucide-react";
import { useMemo, type MouseEvent } from "react";
import * as Y from "yjs";
import { useMembers } from "@/lib/members";
import { useConfirm } from "./ConfirmDialog";

/** "2026-09-30" devient "30 septembre 2026". */
export function formatDate(iso: unknown): string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** Document partagé de l'éditeur (absent dans les aperçus et l'export). */
function sharedDoc(editor: ReactNodeViewProps["editor"]): Y.Doc | null {
  const ext = editor.extensionManager.extensions.find((e) => e.name === "collaboration");
  const doc = (ext?.options as { document?: unknown } | undefined)?.document;
  return doc instanceof Y.Doc ? doc : null;
}

/** "Qui répond ?" : liste des membres du groupe, chacun dans sa couleur. */
function AssigneePicker({ editor, value, onChange }: { editor: ReactNodeViewProps["editor"]; value: string; onChange: (name: string) => void }) {
  const doc = useMemo(() => sharedDoc(editor) ?? new Y.Doc(), [editor]);
  const members = useMembers(doc);
  // Un prénom par personne (plusieurs appareils), dans l'ordre d'arrivée ; la personne choisie reste
  // dans la liste même si elle a été retirée des membres.
  const people = useMemo(() => {
    const byName = new Map<string, string>();
    for (const m of members) if (m.name && !byName.has(m.name)) byName.set(m.name, m.color);
    if (value && !byName.has(value)) byName.set(value, "#6b7280");
    return [...byName].map(([name, color]) => ({ name, color }));
  }, [members, value]);
  const color = people.find((p) => p.name === value)?.color;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Qui répond à cette question ?"
      title="Qui répond à cette question ?"
      data-person={value || undefined}
      style={color ? { color } : undefined}
      className={`question-assignee no-print max-w-[60%] cursor-pointer rounded border border-neutral-200 bg-white px-1 py-0 text-[12px] ${value ? "font-semibold" : "text-neutral-400"}`}
    >
      <option value="" style={{ color: "#737373" }}>
        Qui répond ?
      </option>
      {people.map((p) => (
        <option key={p.name} value={p.name} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

export function QuestionView({ node, editor, getPos }: ReactNodeViewProps) {
  const confirm = useConfirm();
  const locked = Boolean(node.attrs.locked);
  const isSubject = node.attrs.kind === "sujet";
  const label = isSubject ? "Sujet" : "Question";
  const date = typeof node.attrs.date === "string" ? node.attrs.date : "";
  const assignee = typeof node.attrs.assignee === "string" ? node.attrs.assignee : "";
  // Liste seulement dans le document partagé, quand on peut écrire ; ailleurs (professeur, versions,
  // impression) : le prénom choisi.
  const canAssign = editor.isEditable && Boolean(sharedDoc(editor));
  const validated = Boolean(node.attrs.validated);

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

  function changeAssignee(name: string) {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.commands.setQuestionAssignee(pos, name || null);
  }

  function toggleValidated() {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.commands.setQuestionValidated(pos, !validated);
  }

  async function remove() {
    const what = isSubject ? "ce sujet" : "cette question";
    const ok = await confirm({
      title: `Supprimer ${what} ?`,
      message: "Le bloc et son contenu seront supprimés.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    // Position relue après la confirmation (le document a pu changer entre-temps).
    const pos = getPos();
    if (typeof pos !== "number") return;
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
      {!isSubject && (canAssign || assignee || validated) && (
        <div className="question-footer" contentEditable={false}>
          {canAssign && <AssigneePicker editor={editor} value={assignee} onChange={changeAssignee} />}
          {(canAssign || validated) && (
            <button
              type="button"
              onMouseDown={keepSelection}
              onClick={canAssign ? toggleValidated : undefined}
              disabled={!canAssign}
              aria-pressed={validated}
              title={
                validated
                  ? canAssign
                    ? "Réponse validée (texte verrouillé). Clique pour retirer la validation."
                    : "Réponse validée"
                  : "Valider la réponse (le texte sera verrouillé)"
              }
              aria-label={validated ? "Retirer la validation de la réponse" : "Valider la réponse"}
              className={`question-validate no-print ml-1.5 flex h-[20px] w-[22px] items-center justify-center rounded border ${
                validated ? "border-green-600 bg-green-600 text-white" : "border-neutral-300 bg-white text-neutral-300 hover:border-green-600 hover:text-green-600"
              } disabled:cursor-default`}
            >
              <Check size={14} strokeWidth={3} aria-hidden />
            </button>
          )}
          {assignee && (
            <span className={`question-assignee font-semibold${canAssign ? " print-only" : ""}`} data-person={assignee}>
              {assignee}
            </span>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
