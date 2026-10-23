import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  AddMarkStep,
  AddNodeMarkStep,
  AttrStep,
  RemoveMarkStep,
  RemoveNodeMarkStep,
  findWrapping,
  type Step,
} from "@tiptap/pm/transform";
import type { Transaction } from "@tiptap/pm/state";
import { Fragment } from "@tiptap/pm/model";
import { QuestionView } from "@/components/QuestionView";
import { findQuestion, internalKey, isRemote } from "./shared";

export type BlockKind = "question" | "sujet";

/** Date du jour au format AAAA-MM-JJ (heure locale). */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Pourquoi une modification est refusée : question verrouillée, ou réponse validée. */
export type BlockedReason = "question" | "validated";

type QuestionOptions = {
  /** Appelé quand une modification est refusée. */
  onBlocked: (reason: BlockedReason) => void;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    question: {
      /** Insère un bloc question (ou sujet) vide, ou transforme la sélection. */
      toggleQuestion: (kind?: BlockKind) => ReturnType;
      setQuestionDate: (pos: number, date: string | null) => ReturnType;
      setQuestionLocked: (pos: number, locked: boolean) => ReturnType;
      /** Personne qui doit répondre (null : personne). Possible même si la question est verrouillée. */
      setQuestionAssignee: (pos: number, name: string | null) => ReturnType;
      /** Réponse validée (V vert) : le texte de la réponse, sous la question, est verrouillé. */
      setQuestionValidated: (pos: number, validated: boolean) => ReturnType;
      deleteQuestion: (pos: number) => ReturnType;
    };
  }
}

/** Plages de positions touchées par une étape, dans le document avant l'étape. */
function touchedRanges(step: Step): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  step.getMap().forEach((oldStart, oldEnd) => ranges.push([oldStart, oldEnd]));
  if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
    ranges.push([step.from, step.to]);
  }
  if (
    step instanceof AttrStep ||
    step instanceof AddNodeMarkStep ||
    step instanceof RemoveNodeMarkStep
  ) {
    ranges.push([step.pos, step.pos + 1]);
  }
  return ranges;
}

function lockedRanges(state: EditorState): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name !== "question") return true;
    if (node.attrs.locked) ranges.push([pos, pos + node.nodeSize]);
    return false;
  });
  return ranges;
}

/** Réponses validées : de la fin de la question validée jusqu'au sujet ou à la question suivante
 *  (ou la fin de la feuille). Seulement les questions posées directement dans la page. */
export function validatedRanges(state: EditorState): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let open: number | null = null;
  state.doc.forEach((node, offset) => {
    if (node.type.name !== "question") return;
    if (open !== null && offset > open) ranges.push([open, offset]);
    open = node.attrs.kind !== "sujet" && node.attrs.validated ? offset + node.nodeSize : null;
  });
  if (open !== null && state.doc.content.size > open) ranges.push([open, state.doc.content.size]);
  return ranges;
}

/** Vrai si la transaction modifie une des plages (dans le document d'avant). */
function touchesRanges(tr: Transaction, ranges: Array<[number, number]>): boolean {
  if (!ranges.length) return false;
  for (let i = 0; i < tr.steps.length; i++) {
    const before = tr.mapping.slice(0, i);
    const current = ranges.map(([a, b]) => [before.map(a, 1), before.map(b, -1)] as const);
    for (const [from, to] of touchedRanges(tr.steps[i])) {
      for (const [start, end] of current) {
        const hit = from === to ? from > start && from < end : from < end && to > start;
        if (hit) return true;
      }
    }
  }
  return false;
}

/** Vrai si la transaction modifie (ou supprime) une question verrouillée. */
function touchesLockedQuestion(tr: Transaction, state: EditorState): boolean {
  const locked = lockedRanges(state);
  if (!locked.length) return false;
  for (let i = 0; i < tr.steps.length; i++) {
    const before = tr.mapping.slice(0, i);
    const current = locked.map(([a, b]) => [before.map(a, 1), before.map(b, -1)] as const);
    for (const [from, to] of touchedRanges(tr.steps[i])) {
      for (const [start, end] of current) {
        const hit = from === to ? from > start && from < end : from < end && to > start;
        if (hit) return true;
      }
    }
  }
  return false;
}

export const Question = Node.create<QuestionOptions>({
  name: "question",
  group: "block",
  content: "(paragraph | heading | bulletList | orderedList)+",
  defining: true,
  isolating: true,

  addOptions() {
    return { onBlocked: () => {} };
  },

  addAttributes() {
    return {
      kind: {
        default: "question",
        parseHTML: (el) => (el.getAttribute("data-kind") === "sujet" ? "sujet" : "question"),
        renderHTML: (attrs) => ({ "data-kind": attrs.kind }),
      },
      date: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-date"),
        renderHTML: (attrs) => (attrs.date ? { "data-date": attrs.date } : {}),
      },
      assignee: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-assignee") || null,
        renderHTML: (attrs) => (attrs.assignee ? { "data-assignee": attrs.assignee } : {}),
      },
      validated: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-validated") === "true",
        renderHTML: (attrs) => (attrs.validated ? { "data-validated": "true" } : {}),
      },
      locked: {
        default: true,
        parseHTML: (el) => el.getAttribute("data-locked") !== "false",
        renderHTML: (attrs) => ({ "data-locked": attrs.locked ? "true" : "false" }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="question"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "question" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuestionView);
  },

  addCommands() {
    return {
      toggleQuestion:
        (kind = "question") =>
        ({ state, tr, dispatch }) => {
          const { schema, selection } = state;
          const questionType = schema.nodes.question;
          const paragraphType = schema.nodes.paragraph;
          const { $from, $to } = selection;

          const inside = findQuestion($from) ?? findQuestion($to);

          // Cas 1 : du texte est sélectionné (hors question), on le transforme en question.
          if (!selection.empty && !inside) {
            const range = $from.blockRange($to, (node) => node.type.name === "doc");
            if (!range) return false;
            const wrapping = findWrapping(range, questionType, { locked: true, kind, date: today() });
            if (!wrapping) return false;
            if (!dispatch) return true;

            tr.wrap(range, wrapping);
            const start = range.start;
            const question = tr.doc.nodeAt(start);
            if (!question) return false;
            const end = start + question.nodeSize;
            tr.removeMark(start, end, schema.marks.author);
            const next = tr.doc.nodeAt(end);
            if (!next || next.type !== paragraphType || next.content.size > 0) {
              tr.insert(end, paragraphType.create());
            }
            tr.setSelection(TextSelection.create(tr.doc, end + 1));
            tr.setMeta(internalKey, true);
            return true;
          }

          // Cas 2 : pas de sélection, on insère un bloc vide au curseur.
          if (!dispatch) return true;
          const nodes = [
            questionType.create({ locked: false, kind, date: today() }, paragraphType.create()),
            paragraphType.create(),
          ];
          const insertHere = (pos: number) => {
            tr.insert(pos, nodes);
            tr.setSelection(TextSelection.create(tr.doc, pos + 2));
            return true;
          };

          // Curseur dans une question : le nouveau bloc va juste après elle.
          if (inside) return insertHere(inside.pos + inside.node.nodeSize);

          const parent = $from.parent;
          if (parent.isTextblock && $from.depth >= 1) {
            const container = $from.node($from.depth - 1);
            const index = $from.index($from.depth - 1);
            const fragment = Fragment.from(nodes);

            // Ligne vide : le bloc la remplace.
            if (parent.content.size === 0 && container.canReplace(index, index + 1, fragment)) {
              const start = $from.before();
              tr.replaceWith(start, $from.after(), nodes);
              tr.setSelection(TextSelection.create(tr.doc, start + 2));
              return true;
            }
            // Au curseur, même dans une liste ou une case de tableau.
            if (container.canReplace(index + 1, index + 1, fragment)) {
              if ($from.parentOffset === 0 && container.canReplace(index, index, fragment)) {
                return insertHere($from.before());
              }
              if ($from.parentOffset === parent.content.size) return insertHere($from.after());
              tr.split($from.pos);
              return insertHere($from.pos + 1);
            }
            return insertHere($from.after(1));
          }

          // Curseur entre deux blocs (par exemple entre deux questions).
          if ($from.parent.canReplace($from.index(), $from.index(), Fragment.from(nodes))) {
            return insertHere($from.pos);
          }
          return insertHere($from.depth >= 1 ? $from.after(1) : $from.pos);
        },

      setQuestionLocked:
        (pos, locked) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== "question") return false;
          if (dispatch) {
            tr.setNodeAttribute(pos, "locked", locked).setMeta(internalKey, true);
            if (!locked) {
              // On place le curseur à la fin de la question pour pouvoir corriger tout de suite.
              const end = pos + node.nodeSize - 1;
              tr.setSelection(TextSelection.near(tr.doc.resolve(end), -1));
            }
          }
          return true;
        },

      setQuestionAssignee:
        (pos, name) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== "question") return false;
          if (dispatch) tr.setNodeAttribute(pos, "assignee", name || null).setMeta(internalKey, true);
          return true;
        },

      setQuestionValidated:
        (pos, validated) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== "question" || node.attrs.kind === "sujet") return false;
          if (dispatch) tr.setNodeAttribute(pos, "validated", validated).setMeta(internalKey, true);
          return true;
        },

      setQuestionDate:
        (pos, date) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== "question" || node.attrs.locked) return false;
          if (dispatch) tr.setNodeAttribute(pos, "date", date || null).setMeta(internalKey, true);
          return true;
        },

      deleteQuestion:
        (pos) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== "question" || node.attrs.locked) return false;
          if (dispatch) tr.delete(pos, pos + node.nodeSize);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-q": () => this.editor.commands.toggleQuestion("question"),
      "Mod-Alt-s": () => this.editor.commands.toggleQuestion("sujet"),
    };
  },

  addProseMirrorPlugins() {
    const onBlocked = (reason: BlockedReason) => this.options.onBlocked(reason);
    return [
      // Réponse validée : texte verrouillé, avec un trait vert à gauche (écran seulement).
      new Plugin({
        key: new PluginKey("answer-validated"),
        filterTransaction(tr, state) {
          if (!tr.docChanged || isRemote(tr) || tr.getMeta(internalKey)) return true;
          if (!touchesRanges(tr, validatedRanges(state))) return true;
          queueMicrotask(() => onBlocked("validated"));
          return false;
        },
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            for (const [from, to] of validatedRanges(state)) {
              state.doc.nodesBetween(from, to, (node, pos) => {
                if (pos >= from && pos + node.nodeSize <= to) decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "answer-validated" }));
                return false;
              });
            }
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
      new Plugin({
        key: new PluginKey("question-lock"),

        // Refuse toute modification locale d'une question verrouillée.
        filterTransaction(tr, state) {
          if (!tr.docChanged || isRemote(tr) || tr.getMeta(internalKey)) return true;
          if (!touchesLockedQuestion(tr, state)) return true;
          queueMicrotask(() => onBlocked("question"));
          return false;
        },

        // Reverrouille la question dès que le curseur en sort.
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.selectionSet || tr.docChanged)) return null;
          const previous = findQuestion(oldState.selection.$from);
          if (!previous || previous.node.attrs.locked) return null;

          let pos = previous.pos;
          for (const tr of transactions) {
            const result = tr.mapping.mapResult(pos, 1);
            if (result.deleted) return null;
            pos = result.pos;
          }
          const node = newState.doc.nodeAt(pos);
          if (!node || node.type.name !== "question" || node.attrs.locked) return null;

          const current = findQuestion(newState.selection.$from);
          if (current && current.pos === pos) return null;

          return newState.tr
            .setNodeAttribute(pos, "locked", true)
            .setMeta(internalKey, true)
            .setMeta("addToHistory", false);
        },
      }),
    ];
  },
});
