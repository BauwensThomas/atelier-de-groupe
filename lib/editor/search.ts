import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

// Recherche dans le document : tous les résultats surlignés, le résultat courant plus foncé.

type Match = { from: number; to: number };
type SearchState = { query: string; matches: Match[]; current: number; deco: DecorationSet };
type SearchMeta = { query?: string; current?: number };

export const searchKey = new PluginKey<SearchState>("gp-search");

/** Sans majuscules ni accents : "eleve" trouve "Élève". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function findMatches(doc: PMNode, query: string): Match[] {
  const q = fold(query);
  const out: Match[] = [];
  if (!q.trim()) return out;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Texte du paragraphe et position de chaque caractère (un mot peut être coupé en plusieurs couleurs).
    let text = "";
    const map: number[] = [];
    node.forEach((child, offset) => {
      const chars = child.isText && child.text ? child.text : "￼";
      for (let i = 0; i < chars.length; i++) {
        const folded = fold(chars[i]);
        text += folded;
        for (let k = 0; k < folded.length; k++) map.push(pos + 1 + offset + i);
      }
    });
    let index = text.indexOf(q);
    while (index !== -1) {
      out.push({ from: map[index], to: map[index + q.length - 1] + 1 });
      index = text.indexOf(q, index + q.length);
    }
    return false;
  });
  return out;
}

function build(doc: PMNode, query: string, current: number): SearchState {
  const matches = findMatches(doc, query);
  const index = matches.length ? Math.min(Math.max(current, 0), matches.length - 1) : 0;
  const deco = DecorationSet.create(
    doc,
    matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === index ? "search-hit search-current" : "search-hit" })),
  );
  return { query, matches, current: index, deco };
}

export const Search = Extension.create({
  name: "search",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: (_, state) => build(state.doc, "", 0),
          apply(tr, prev) {
            const meta = tr.getMeta(searchKey) as SearchMeta | undefined;
            if (meta) return build(tr.doc, meta.query ?? prev.query, meta.current ?? 0);
            if (tr.docChanged && prev.query) return build(tr.doc, prev.query, prev.current);
            return prev;
          },
        },
        props: {
          decorations: (state) => searchKey.getState(state)?.deco,
        },
      }),
    ];
  },
});

export function searchInfo(state: EditorState): { query: string; count: number; current: number } {
  const s = searchKey.getState(state);
  return { query: s?.query ?? "", count: s?.matches.length ?? 0, current: s?.current ?? 0 };
}

function revealCurrent(editor: Editor) {
  requestAnimationFrame(() => {
    editor.view.dom.querySelector(".search-current")?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

export function setSearchQuery(editor: Editor, query: string) {
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query, current: 0 }));
  revealCurrent(editor);
}

export function moveSearch(editor: Editor, step: 1 | -1) {
  const s = searchKey.getState(editor.state);
  if (!s || !s.matches.length) return;
  const current = (s.current + step + s.matches.length) % s.matches.length;
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, { current }));
  revealCurrent(editor);
}

/** Ferme la recherche et place le curseur sur le résultat courant. */
export function closeSearch(editor: Editor) {
  const s = searchKey.getState(editor.state);
  const match = s?.matches[s.current];
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query: "", current: 0 }));
  if (match) editor.chain().focus().setTextSelection(match).run();
}
