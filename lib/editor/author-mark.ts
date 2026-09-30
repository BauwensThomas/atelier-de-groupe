import { Mark } from "@tiptap/core";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import type { Identity } from "@/lib/identity";
import { internalKey, isRemote, isSafeColor } from "./shared";

type AuthorOptions = {
  /** Renvoie l'identité courante (prénom, couleur), ou null si pas encore choisie. */
  getUser: () => Identity | null;
};

/**
 * Plages de texte nouvellement insérées par ces transactions, en positions du document final.
 * Les transactions internes (reverrouillage d'une question, etc.) sont ignorées, mais leurs
 * déplacements de positions sont pris en compte.
 */
function insertedRanges(transactions: readonly Transaction[]): Array<[number, number]> {
  const mapping = new Mapping();
  const counted: boolean[] = [];
  for (const tr of transactions) {
    const internal = Boolean(tr.getMeta(internalKey));
    for (const map of tr.mapping.maps) {
      mapping.appendMap(map);
      counted.push(!internal);
    }
  }
  const ranges: Array<[number, number]> = [];
  mapping.maps.forEach((map, index) => {
    if (!counted[index]) return;
    const rest = mapping.slice(index + 1);
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      if (newEnd <= newStart) return;
      const from = rest.map(newStart, 1);
      const to = rest.map(newEnd, -1);
      if (to > from) ranges.push([from, to]);
    });
  });
  return ranges;
}

export const AuthorMark = Mark.create<AuthorOptions>({
  name: "author",
  inclusive: false,
  excludes: "author",

  addOptions() {
    return { getUser: () => null };
  },

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-author"),
        renderHTML: () => ({}),
      },
      color: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-author-color"),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-author]" }];
  },

  renderHTML({ mark }) {
    const name = typeof mark.attrs.name === "string" ? mark.attrs.name : "";
    const color = isSafeColor(mark.attrs.color) ? mark.attrs.color : null;
    const attrs: Record<string, string> = { "data-author": name };
    if (color) {
      attrs["data-author-color"] = color;
      attrs.style = `color: ${color}`;
    }
    return ["span", attrs, 0];
  },

  addProseMirrorPlugins() {
    const getUser = () => this.options.getUser();
    return [
      new Plugin({
        key: new PluginKey("author-mark"),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          // Les changements venus des autres (ou de l'historique Yjs) gardent leur auteur.
          if (transactions.some((tr) => isRemote(tr))) return null;

          const ranges = insertedRanges(transactions);
          if (!ranges.length) return null;

          const user = getUser();
          const type = newState.schema.marks.author;
          const deleted = newState.schema.marks.deleted;
          const tr = newState.tr;

          for (const [from, to] of ranges) {
            newState.doc.nodesBetween(from, to, (node, pos) => {
              if (node.type.name === "question") {
                // Dans une question : jamais de couleur d'auteur.
                const start = Math.max(from, pos);
                const end = Math.min(to, pos + node.nodeSize);
                if (newState.doc.rangeHasMark(start, end, type)) tr.removeMark(start, end, type);
                if (deleted && newState.doc.rangeHasMark(start, end, deleted)) tr.removeMark(start, end, deleted);
                return false;
              }
              if (!node.isText) return true;
              const start = Math.max(from, pos);
              const end = Math.min(to, pos + node.nodeSize);
              // Un texte nouveau n'est jamais barré (frappe au milieu d'une rature, collage).
              if (deleted && deleted.isInSet(node.marks)) tr.removeMark(start, end, deleted);
              if (!user) return false;
              const current = type.isInSet(node.marks);
              if (current?.attrs.name !== user.name || current?.attrs.color !== user.color) {
                tr.addMark(start, end, type.create({ name: user.name, color: user.color }));
              }
              return false;
            });
          }

          if (!tr.docChanged) return null;
          // Pas de addToHistory=false : la couleur doit être annulée/rétablie avec le texte.
          return tr.setMeta(internalKey, true);
        },
      }),
    ];
  },
});
