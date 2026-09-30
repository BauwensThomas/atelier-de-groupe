import { Mark } from "@tiptap/core";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Mapping, type ReplaceStep, type Step } from "@tiptap/pm/transform";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Identity } from "@/lib/identity";
import { internalKey, isRemote, isSafeColor } from "./shared";

type TrackOptions = {
  getUser: () => Identity | null;
};

/** Étape de remplacement simple (frappe, suppression, collage). */
function isReplace(step: Step): step is ReplaceStep {
  return step.toJSON().stepType === "replace";
}

type Piece = { from: number; to: number; keep: boolean; mark: boolean };

/** Auteur d'un morceau de texte (null si pas de couleur d'auteur, par exemple dans une question). */
function authorOf(node: PMNode): string | null {
  const mark = node.marks.find((m) => m.type.name === "author");
  return mark ? (mark.attrs.name as string) : null;
}

function isStruck(node: PMNode): boolean {
  return node.marks.some((m) => m.type.name === "deleted");
}

/** Vrai si la plage contient du texte écrit par quelqu'un d'autre. */
function hasOthersText(doc: PMNode, from: number, to: number, me: string): boolean {
  let found = false;
  doc.nodesBetween(from, to, (node) => {
    if (found) return false;
    if (node.isText) {
      const author = authorOf(node);
      if (author && author !== me) found = true;
    }
    return true;
  });
  return found;
}

/**
 * Supprime la plage en gardant le texte des autres (barré) :
 * - mon texte, ou le texte sans auteur : supprimé ;
 * - le texte d'un autre : barré (ou laissé tel quel s'il l'est déjà).
 * La structure (paragraphes, listes, tableaux) est conservée.
 */
function trackedDelete(tr: Transaction, from: number, to: number, user: Identity) {
  const pieces: Piece[] = [];
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return true;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    if (end <= start) return false;
    const author = node.isText ? authorOf(node) : null;
    const others = author !== null && author !== user.name;
    pieces.push({ from: start, to: end, keep: others, mark: others && !isStruck(node) });
    return false;
  });

  const deletedType = tr.doc.type.schema.marks.deleted;
  for (const p of pieces) {
    if (p.mark) tr.addMark(p.from, p.to, deletedType.create({ name: user.name, color: user.color }));
  }
  for (let i = pieces.length - 1; i >= 0; i--) {
    if (!pieces[i].keep) tr.delete(pieces[i].from, pieces[i].to);
  }
}

/** Réécrit la transaction si elle efface le texte d'un autre. Renvoie null sinon. */
function rewrite(original: Transaction, state: EditorState, user: Identity): Transaction | null {
  const touchesOthers = original.steps.some(
    (step, i) =>
      isReplace(step) &&
      step.from < step.to &&
      hasOthersText(original.docs[i], step.from, step.to, user.name),
  );
  if (!touchesOthers) return null;

  const out = state.tr;
  const cursorBefore = state.selection.empty ? state.selection.from : null;
  let toOut = new Mapping(); // positions du document d'origine (étape i) vers `out`
  let cursor: number | null = null;
  let cursorStart = 0;

  original.steps.forEach((step, i) => {
    const outStart = out.mapping.maps.length;
    const doc = original.docs[i];

    if (isReplace(step) && step.from < step.to && hasOthersText(doc, step.from, step.to, user.name)) {
      const from = toOut.map(step.from, 1);
      const to = toOut.map(step.to, -1);
      const mark = out.mapping.maps.length;
      if (to > from) trackedDelete(out, from, to, user);
      const after = out.mapping.slice(mark);
      const end = after.map(to, 1);

      if (step.slice.size > 0) {
        // Texte tapé ou collé par-dessus : il vient après le texte barré.
        const before = out.mapping.maps.length;
        try {
          out.replace(end, end, step.slice);
        } catch {
          // contenu impossible à insérer ici : on l'ignore
        }
        cursor = out.mapping.slice(before).map(end, 1);
      } else if (cursorBefore !== null && cursorBefore === step.from) {
        cursor = end; // touche Suppr : le curseur passe après le texte barré
      } else {
        cursor = after.map(from, -1); // retour arrière ou sélection : avant le texte barré
      }
      cursorStart = out.mapping.maps.length;
    } else {
      const mapped = step.map(toOut);
      if (mapped) out.maybeStep(mapped);
    }

    const next = new Mapping();
    next.appendMap(step.getMap().invert());
    next.appendMapping(toOut);
    next.appendMapping(out.mapping.slice(outStart));
    toOut = next;
  });

  if (cursor !== null) {
    const pos = Math.min(out.mapping.slice(cursorStart).map(cursor), out.doc.content.size);
    out.setSelection(TextSelection.near(out.doc.resolve(pos)));
  }
  const uiEvent = original.getMeta("uiEvent");
  if (uiEvent) out.setMeta("uiEvent", uiEvent);
  if (original.scrolledIntoView) out.scrollIntoView();
  return out;
}

/** Texte effacé par quelqu'un d'autre que son auteur : il reste, barré. */
export const DeletedMark = Mark.create<TrackOptions>({
  name: "deleted",
  inclusive: false,

  addOptions() {
    return { getUser: () => null };
  },

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-deleted-by"),
        renderHTML: () => ({}),
      },
      color: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-deleted-color"),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-deleted-by]" }];
  },

  renderHTML({ mark }) {
    const name = typeof mark.attrs.name === "string" ? mark.attrs.name : "";
    const attrs: Record<string, string> = { "data-deleted-by": name, class: "tracked-deletion" };
    if (isSafeColor(mark.attrs.color)) {
      attrs["data-deleted-color"] = mark.attrs.color;
      attrs.style = `text-decoration-color: ${mark.attrs.color}`;
    }
    return ["span", attrs, 0];
  },

  dispatchTransaction({ transaction, next }) {
    const user = this.options.getUser();
    if (!user || !transaction.docChanged || isRemote(transaction) || transaction.getMeta(internalKey)) {
      next(transaction);
      return;
    }
    const rewritten = rewrite(transaction, this.editor.state, user);
    next(rewritten ?? transaction);
  },
});
