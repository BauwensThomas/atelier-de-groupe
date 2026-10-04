import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

// Pagination visuelle façon Word : sauts de page dessinés entre les blocs, numéro en bas de chaque page.
// Un bloc (paragraphe, question, tableau) n'est jamais coupé : s'il ne tient plus, il passe à la page suivante.

const key = new PluginKey<PaginationState>("pagination");
const GAP = 24; // espace gris entre deux pages, en pixels
const MIN_WIDTH = 500; // en dessous (téléphone), pas de pagination

type Layout = { padTop: number; padBottom: number; padLeft: number; padRight: number };

// Résultat du calcul : sauts de page placés avant le n-ième bloc du document (et non à une position dans le texte).
// Quand le document est remplacé d'un coup (modification venue d'un autre écran), les sauts restent ainsi en place
// jusqu'au calcul suivant : la page ne "saute" plus (avant, ils disparaissaient un instant et l'écran bougeait).
type Pages = { breaks: Array<{ index: number; n: number; filler: number }>; last: number; endFiller: number; layout: Layout } | null;
type PaginationState = { pages: Pages; set: DecorationSet };

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

function measure(view: EditorView): Pages {
  const pageEl = view.dom.closest<HTMLElement>(".page");
  if (!pageEl || pageEl.clientWidth < MIN_WIDTH) {
    pageEl?.classList.remove("paginated");
    return null;
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
  // Zoom de la page (loupe) : les mesures à l'écran sont agrandies, on les ramène à la vraie taille.
  const pageRect = pageEl.getBoundingClientRect();
  const scale = pageEl.offsetWidth ? pageRect.width / pageEl.offsetWidth : 1;
  const origin = pageRect.top / scale + layout.padTop;

  // Hauteurs des sauts de page déjà affichés : on les retire pour retrouver le texte "sans pages".
  const widgets = Array.from(view.dom.querySelectorAll<HTMLElement>(":scope > .page-break")).map((w) => {
    const r = w.getBoundingClientRect();
    return { top: r.top / scale, height: r.height / scale };
  });
  const flow = (y: number) => y - origin - widgets.filter((w) => w.top < y).reduce((s, w) => s + w.height, 0);

  const breaks: Array<{ index: number; n: number; filler: number }> = [];
  let pageTop = 0;
  let previousBottom = 0;
  let page = 1;

  view.state.doc.forEach((node, offset, index) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();
    const top = flow(rect.top / scale);
    const bottom = top + rect.height / scale;
    if (bottom - pageTop > contentHeight && top > pageTop + 1) {
      breaks.push({ index, n: page, filler: pageTop + contentHeight - previousBottom });
      page += 1;
      pageTop = top;
    }
    previousBottom = bottom;
  });

  return { breaks, last: page, endFiller: pageTop + contentHeight - previousBottom, layout };
}

/** Décorations des pages pour ce document : chaque saut avant son n-ième bloc, la fin de page tout en bas. */
function build(doc: PMNode, pages: Pages): DecorationSet {
  if (!pages) return DecorationSet.empty;
  const { layout } = pages;
  const offsets: number[] = [];
  doc.forEach((_node, offset) => offsets.push(offset));
  const decorations: Decoration[] = [];
  for (const b of pages.breaks) {
    if (b.index >= offsets.length) break;
    decorations.push(
      Decoration.widget(offsets[b.index], () => breakWidget(b.n, b.filler, layout), {
        side: -1,
        ignoreSelection: true,
        key: `pb-${b.n}-${Math.round(b.filler)}-${Math.round(layout.padTop)}`,
      }),
    );
  }
  decorations.push(
    Decoration.widget(doc.content.size, () => endWidget(pages.last, pages.endFiller, layout), {
      side: 1,
      ignoreSelection: true,
      key: `pe-${pages.last}-${Math.round(pages.endFiller)}-${Math.round(layout.padBottom)}`,
    }),
  );
  return DecorationSet.create(doc, decorations);
}

/** Numéros des blocs qui commencent une nouvelle page à l'écran (pour l'export Word). */
export function pageBreakIndices(state: EditorState): number[] {
  return key.getState(state)?.pages?.breaks.map((b) => b.index) ?? [];
}

export const Pagination = Extension.create({
  name: "pagination",

  addProseMirrorPlugins() {
    return [
      new Plugin<PaginationState>({
        key,
        state: {
          init: () => ({ pages: null, set: DecorationSet.empty }),
          apply(tr, prev) {
            const measured = tr.getMeta(key) as { pages: Pages } | undefined;
            if (measured) return { pages: measured.pages, set: build(tr.doc, measured.pages) };
            // Texte modifié : mêmes sauts, replacés avant les mêmes blocs (le calcul exact suit juste après).
            if (tr.docChanged) return { pages: prev.pages, set: build(tr.doc, prev.pages) };
            return prev;
          },
        },
        props: {
          decorations: (state) => key.getState(state)?.set,
        },
        view(view) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          let frame = 0;
          const run = () => {
            if (view.isDestroyed) return;
            const pages = measure(view);
            view.dispatch(view.state.tr.setMeta(key, { pages }).setMeta("addToHistory", false));
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
