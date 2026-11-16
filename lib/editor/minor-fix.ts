import { PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import type { ReplaceStep } from "@tiptap/pm/transform";
import type { Identity } from "@/lib/identity";

// Petites corrections dans le texte d'un autre : majuscules, accents, espaces et ponctuation.
// Le texte corrigé garde la couleur de son auteur, sans rien de barré : seule la forme change, le contenu
// reste le sien. L'activité note "a corrigé des majuscules, accents ou ponctuation dans le texte de X".
// Tout autre changement (un mot, une lettre en plus ou en moins) reste dans la couleur de celui qui l'écrit,
// et le texte effacé reste barré, comme avant.

/** Meta posée sur une petite correction : le prénom de l'auteur du texte corrigé. */
export const minorFixKey = new PluginKey<string>("gp-minor-fix");

// Espaces et ponctuation (tirets moyen et long écrits en code, pour ne pas les avoir dans le fichier).
const IGNORED = /[\s.,;:!?'"`20182019201c201d00ab00bb()[\]{}\-201320142026/]/g;

/** Texte sans majuscules, accents, espaces ni ponctuation : deux textes qui donnent le même sont "la même chose". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(IGNORED, "");
}

/** Vrai si passer de `before` à `after` ne change que la forme (majuscules, accents, espaces, ponctuation). */
export function isMinorEdit(before: string, after: string): boolean {
  if (before === after) return false;
  return normalize(before) === normalize(after);
}

const authorOf = (node: PMNode): string | null => {
  const mark = node.marks.find((m) => m.type.name === "author");
  return mark && typeof mark.attrs.name === "string" ? mark.attrs.name : null;
};
const struckBy = (node: PMNode): string | null => {
  const mark = node.marks.find((m) => m.type.name === "deleted");
  return mark ? String(mark.attrs.name ?? "") : null;
};
const withoutStrike = (marks: readonly Mark[]): Mark[] => marks.filter((m) => m.type.name !== "deleted");

type Run = { text: string; author: string; marks: readonly Mark[]; struck: string | null };

/** Texte d'une plage dans un même paragraphe, écrite par une seule personne. null sinon. */
function runAt(doc: PMNode, from: number, to: number): Run | null {
  const $from = doc.resolve(from);
  if (!$from.parent.isTextblock || !$from.sameParent(doc.resolve(to))) return null;
  let run: Run | null = null;
  let mixed = false;
  doc.nodesBetween(from, to, (node, pos) => {
    if (mixed) return false;
    if (!node.isInline) return true; // document, liste, paragraphe... : on descend jusqu'au texte
    if (!node.isText) return (mixed = true), false; // image, saut de ligne : pas une petite correction
    const author = authorOf(node);
    const struck = struckBy(node);
    const part = node.text!.slice(Math.max(from, pos) - pos, Math.min(to, pos + node.nodeSize) - pos);
    if (!author || (run && (run.author !== author || run.struck !== struck))) return (mixed = true), false;
    run = run ? { ...run, text: run.text + part } : { text: part, author, marks: node.marks, struck };
    return false;
  });
  return mixed ? null : run;
}

/** Texte tapé ou collé, s'il ne contient que du texte (pas de paragraphe, d'image...). */
function insertedText(step: ReplaceStep): string | null {
  const { content } = step.slice;
  let text = "";
  let ok = true;
  content.forEach((node) => {
    if (node.isText) text += node.text;
    else ok = false;
  });
  return ok ? text : null;
}

function finish(state: EditorState, original: Transaction, from: number, to: number, text: string, marks: readonly Mark[], author: string, cursor: number) {
  const tr = state.tr;
  if (text) tr.replaceWith(from, to, state.schema.text(text, withoutStrike(marks)));
  else tr.delete(from, to);
  tr.setSelection(TextSelection.create(tr.doc, Math.min(cursor, tr.doc.content.size)));
  tr.setMeta(minorFixKey, author);
  const uiEvent = original.getMeta("uiEvent");
  if (uiEvent) tr.setMeta("uiEvent", uiEvent);
  if (original.scrolledIntoView) tr.scrollIntoView();
  return tr;
}

/**
 * Si la frappe (ou le collage) est une petite correction du texte d'un autre, renvoie la transaction
 * qui la fait en gardant son auteur. Sinon null : la frappe suit son cours normal.
 */
export function minorFix(original: Transaction, state: EditorState, user: Identity): Transaction | null {
  if (original.steps.length !== 1) return null;
  const step = original.steps[0];
  if (step.toJSON().stepType !== "replace") return null;
  const replace = step as ReplaceStep;
  const text = insertedText(replace);
  if (text === null) return null;
  const { doc } = state;
  const { from, to } = replace;

  // 1. Texte sélectionné (ou effacé) remplacé : "paris" devient "Paris", une virgule effacée...
  if (to > from) {
    const run = runAt(doc, from, to);
    if (!run || run.author === user.name || run.struck) return null;
    if (!isMinorEdit(run.text, text)) return null;
    return finish(state, original, from, to, text, run.marks, run.author, from + text.length);
  }
  if (!text) return null;

  // 2. Lettre retapée juste à côté d'une lettre de l'autre qu'on vient de barrer (retour arrière puis
  //    frappe) : la lettre barrée est remplacée par la nouvelle, dans la couleur de l'auteur.
  const after = runAt(doc, from, Math.min(from + text.length, doc.resolve(from).end()));
  if (after && after.text.length === text.length && after.struck === user.name && after.author !== user.name && normalize(after.text) === normalize(text)) {
    return finish(state, original, from, from + text.length, text, after.marks, after.author, from + text.length);
  }
  const before = runAt(doc, Math.max(from - text.length, doc.resolve(from).start()), from);
  if (before && before.text.length === text.length && before.struck === user.name && before.author !== user.name && normalize(before.text) === normalize(text)) {
    return finish(state, original, from - text.length, from, text, before.marks, before.author, from);
  }

  // 3. Espace ou ponctuation ajoutée dans le texte d'un autre (ou juste à sa fin).
  if (normalize(text) !== "") return null;
  const $pos = doc.resolve(from);
  const prev = $pos.nodeBefore;
  const next = $pos.nodeAfter;
  const prevAuthor = prev?.isText && !struckBy(prev) ? authorOf(prev) : null;
  const nextAuthor = next?.isText && !struckBy(next) ? authorOf(next) : null;
  const author = prevAuthor ?? nextAuthor;
  if (!author || author === user.name) return null;
  if ((prevAuthor && prevAuthor !== author) || (nextAuthor && nextAuthor !== author)) return null;
  const marks = (prevAuthor ? prev! : next!).marks;
  return finish(state, original, from, from, text, marks, author, from + text.length);
}
