import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { resolveAnchor, type Thread } from "@/lib/comments";

// Surlignage des passages commentés, avec une pastille (nombre de messages) à la fin du passage.
// Les commentaires résolus ne sont plus surlignés.

type CommentState = { threads: Thread[]; active: string | null; deco: DecorationSet };
type CommentMeta = { threads?: Thread[]; active?: string | null; refresh?: boolean };

export const commentsKey = new PluginKey<CommentState>("gp-comments");

type Options = { onOpen: (id: string) => void };

function build(state: EditorState, threads: Thread[], active: string | null, onOpen: (id: string) => void): DecorationSet {
  const decos: Decoration[] = [];
  for (const t of threads) {
    if (t.resolved) continue;
    const range = resolveAnchor(state, t);
    if (!range) continue;
    const kind = t.prof ? " comment-prof" : "";
    const on = t.id === active ? " comment-active" : "";
    decos.push(Decoration.inline(range.from, range.to, { class: `comment-hl${kind}${on}`, "data-thread": t.id }));
    const count = 1 + t.replies.length;
    decos.push(
      Decoration.widget(
        range.to,
        () => {
          const badge = document.createElement("button");
          badge.type = "button";
          badge.className = `comment-badge${kind}`;
          badge.contentEditable = "false";
          badge.textContent = t.prof ? `Prof ${count}` : String(count);
          badge.title = t.prof ? "Note du professeur" : `Commentaire de ${t.name}`;
          badge.setAttribute("aria-label", badge.title);
          badge.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpen(t.id);
          });
          return badge;
        },
        { side: 1, ignoreSelection: true, key: `c-${t.id}-${count}-${t.prof ? 1 : 0}`, stopEvent: () => true },
      ),
    );
  }
  return DecorationSet.create(state.doc, decos);
}

export const Comments = Extension.create<Options>({
  name: "comments",

  addOptions() {
    return { onOpen: () => {} };
  },

  addProseMirrorPlugins() {
    const onOpen = (id: string) => this.options.onOpen(id);
    let timer: ReturnType<typeof setTimeout> | null = null;
    return [
      new Plugin<CommentState>({
        key: commentsKey,
        state: {
          init: () => ({ threads: [], active: null, deco: DecorationSet.empty }),
          apply(tr, prev, _old, state) {
            const meta = tr.getMeta(commentsKey) as CommentMeta | undefined;
            if (meta) {
              const threads = meta.threads ?? prev.threads;
              const active = meta.active !== undefined ? meta.active : prev.active;
              return { threads, active, deco: build(state, threads, active, onOpen) };
            }
            // Pendant la frappe, on décale simplement les surlignages ; le recalcul exact vient juste après.
            if (tr.docChanged) return { ...prev, deco: prev.deco.map(tr.mapping, tr.doc) };
            return prev;
          },
        },
        props: {
          decorations: (state) => commentsKey.getState(state)?.deco,
        },
        view: () => ({
          update(view, prevState) {
            if (view.state.doc === prevState.doc) return;
            if (!commentsKey.getState(view.state)?.threads.length) return;
            // Le document Yjs est à jour un instant après : recalcul exact des passages.
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              timer = null;
              if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(commentsKey, { refresh: true }));
            }, 300);
          },
          destroy() {
            if (timer) clearTimeout(timer);
          },
        }),
      }),
    ];
  },
});
