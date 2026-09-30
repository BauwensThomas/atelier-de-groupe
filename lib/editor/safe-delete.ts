import { Extension } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";

// Longueur (1 ou 2) du caractère juste avant ou après la position, pour ne pas couper un caractère spécial.
function charLength(state: EditorState, pos: number, backward: boolean): number {
  const text = backward
    ? state.doc.textBetween(Math.max(pos - 2, 0), pos, "\0", "\0")
    : state.doc.textBetween(pos, Math.min(pos + 2, state.doc.content.size), "\0", "\0");
  if (text.length === 2) {
    const code = text.charCodeAt(backward ? 0 : 1);
    const isPair = backward ? code >= 0xd800 && code <= 0xdbff : code >= 0xdc00 && code <= 0xdfff;
    if (isPair) return 2;
  }
  return 1;
}

/**
 * Retour arrière et Suppr gérés par l'éditeur plutôt que par le navigateur.
 * Sinon, quand le curseur d'un autre est collé au nôtre, Chrome efface son
 * étiquette au lieu du caractère et la suppression est perdue.
 */
export const SafeDelete = Extension.create({
  name: "safeDelete",
  // Passe après les raccourcis de TipTap (listes, règles de saisie...).
  priority: 1,

  addKeyboardShortcuts() {
    const remove = (backward: boolean) => {
      const { state, view } = this.editor;
      const { selection } = state;
      if (!selection.empty) return false;
      const $pos = selection.$from;
      const neighbour = backward ? $pos.nodeBefore : $pos.nodeAfter;
      if (!neighbour?.isText) return false;
      const len = Math.min(charLength(state, $pos.pos, backward), neighbour.nodeSize);
      const from = backward ? $pos.pos - len : $pos.pos;
      view.dispatch(state.tr.delete(from, from + len).scrollIntoView());
      return true;
    };
    return {
      Backspace: () => remove(true),
      Delete: () => remove(false),
    };
  },
});
