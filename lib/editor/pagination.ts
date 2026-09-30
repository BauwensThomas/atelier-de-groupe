import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

// Pagination visuelle façon Word : sauts de page dessinés entre les blocs, numéro en bas de chaque page.
// Un bloc (paragraphe, question, tableau) n'est jamais coupé : s'il ne tient plus, il passe à la page suivante.

const key = new PluginKey<DecorationSet>("pagination");
const GAP = 24; // espace gris entre deux pages, en pixels
const MIN_WIDTH = 500; // en dessous (téléphone), pas de pagination

type Layout = { padTop: number; padBottom: number; padLeft: number; padRight: number };

function pageNumber(n: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "page-number";
  el.textContent = String(n);
  return el;
}

/** Saut de page : fin de la page n (espace restant + marge du bas + numéro), espace gris, marge du haut. */
function breakWidget(n: number, filler: number, layout: Layout): HTMLElement {
  const el = document.createElement("div");
  el.className = "page-break";
  el.contentEditable = "false";
  el.style.marginLeft = `${-layout.padLeft}px`;
  el.style.marginRight = `${-layout.padRight}px`;

  const fill = document.createElement("div");
  fill.style.height = `${Math.max(0, filler)}px`;

  const bottom = document.createElement("div");
  bottom.className = "page-margin";
  bottom.style.height = `${layout.padBottom}px`;
  bottom.appendChild(pageNumber(n));

  const gap = document.createElement("div");
  gap.className = "page-gap";
  gap.style.height = `${GAP}px`;

  const top = document.createElement("div");
  top.style.height = `${layout.padTop}px`;

  el.append(fill, bottom, gap, top);
  return el;
}

/** Fin de la dernière page : espace restant + marge du bas avec le numéro. */
function endWidget(n: number, filler: number, layout: Layout): HTMLElement {
  const el = document.createElement("div");
  el.className = "page-end";
  el.contentEditable = "false";
  el.style.marginLeft = `${-layout.padLeft}px`;
  el.style.marginRight = `${-layout.padRight}px`;

  const fill = document.createElement("div");
  fill.style.height = `${Math.max(0, filler)}px`;

  const bottom = document.createElement("div");
  bottom.className = "page-margin";
  bottom.style.height = `${layout.padBottom}px`;
  bottom.appendChild(pageNumber(n));

  el.append(fill, bottom);
  return el;
}

function measure(view: EditorView): DecorationSet {
  const pageEl = view.dom.closest<HTMLElement>(".page");
  if (!pageEl || pageEl.clientWidth < MIN_WIDTH) {
    pageEl?.classList.remove("paginated");
    return DecorationSet.empty;
  }
  pageEl.classList.add("paginated");

  const style = getComputedStyle(pageEl);
  const layout: Layout = {
    padTop: parseFloat(style.paddingTop),
    padBottom: parseFloat(style.paddingTop), // marge du bas identique à celle du haut
    padLeft: parseFloat(style.paddingLeft),
    padRight: parseFloat(style.paddingRight),
  };
  const pageHeight = (pageEl.clientWidth * 297) / 210; // proportions A4
  const contentHeight = pageHeight - layout.padTop - layout.padBottom;
  const origin = pageEl.getBoundingClientRect().top + layout.padTop;

  // Hauteurs des sauts de page déjà affichés : on les retire pour retrouver le texte "sans pages".
  const widgets = Array.from(view.dom.querySelectorAll<HTMLElement>(":scope > .page-break")).map((w) => {
    const r = w.getBoundingClientRect();
    return { top: r.top, height: r.height };
  });
  const flow = (y: number) => y - origin - widgets.filter((w) => w.top < y).reduce((s, w) => s + w.height, 0);

  const decorations: Decoration[] = [];
  let pageTop = 0;
  let previousBottom = 0;
  let page = 1;

  view.state.doc.forEach((node, offset) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();
    const top = flow(rect.top);
    const bottom = top + rect.height;
    if (bottom - pageTop > contentHeight && top > pageTop + 1) {
      const filler = pageTop + contentHeight - previousBottom;
      const n = page;
      decorations.push(
        Decoration.widget(offset, () => breakWidget(n, filler, layout), {
          side: -1,
          ignoreSelection: true,
          key: `pb-${n}-${Math.round(filler)}-${Math.round(layout.padTop)}`,
        }),
      );
      page += 1;
      pageTop = top;
    }
    previousBottom = bottom;
  });

  const filler = pageTop + contentHeight - previousBottom;
  const last = page;
  decorations.push(
    Decoration.widget(view.state.doc.content.size, () => endWidget(last, filler, layout), {
      side: 1,
      ignoreSelection: true,
      key: `pe-${last}-${Math.round(filler)}-${Math.round(layout.padBottom)}`,
    }),
  );
  return DecorationSet.create(view.state.doc, decorations);
}

export const Pagination = Extension.create({
  name: "pagination",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const next = tr.getMeta(key) as DecorationSet | undefined;
            return next ?? set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => key.getState(state),
        },
        view(view) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          let frame = 0;
          const run = () => {
            if (view.isDestroyed) return;
            const set = measure(view);
            view.dispatch(view.state.tr.setMeta(key, set).setMeta("addToHistory", false));
          };
          const schedule = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
              cancelAnimationFrame(frame);
              frame = requestAnimationFrame(run);
            }, 120);
          };

          // Recalcul si la largeur de la page change, ou si l'en-tête (titre, auteurs) change de hauteur.
          const pageEl = view.dom.closest<HTMLElement>(".page");
          const header = pageEl?.querySelector<HTMLElement>(":scope > header") ?? null;
          let lastWidth = pageEl?.clientWidth ?? 0;
          let lastHeader = header?.offsetHeight ?? 0;
          const observer = new ResizeObserver(() => {
            const width = pageEl?.clientWidth ?? 0;
            const headerHeight = header?.offsetHeight ?? 0;
            if (width !== lastWidth || headerHeight !== lastHeader) {
              lastWidth = width;
              lastHeader = headerHeight;
              schedule();
            }
          });
          if (pageEl) observer.observe(pageEl);
          if (header) observer.observe(header);
          document.fonts?.ready.then(schedule).catch(() => {});
          schedule();

          return {
            update(v, prev) {
              if (!v.state.doc.eq(prev.doc)) schedule();
            },
            destroy() {
              clearTimeout(timer);
              cancelAnimationFrame(frame);
              observer.disconnect();
            },
          };
        },
      }),
    ];
  },
});
