import type { JSONContent } from "@tiptap/core";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
} from "docx";

const BLACK = "000000";
// Mêmes hauteurs qu'à l'écran (globals.css), en vingtièmes de point (1 pixel = 15) : Word doit couper
// les pages aux mêmes endroits. Interlignes "exacts" (Word compterait sinon 1,6 fois la hauteur de la police,
// soit 15 % de plus), espaces entre blocs comme les marges CSS (la plus grande des deux, pas leur somme).
const FONT = "Arial"; // proche d'Inter (police de l'écran) et présente sur tous les ordinateurs
const TEXT_SIZE = 23; // 11,5 pt, en demi-points
const LINE = 368; // interligne de l'écran : 1,6 x 11,5 pt
const GAP = 138; // 0,6 em entre deux blocs
const HEADING = {
  1: { size: 41, line: 518, margin: 414 },
  2: { size: 32, line: 419, margin: 290 },
  3: { size: 26, line: 423, margin: 212 },
} as const;
const QUESTION_MARGIN = 230; // 1 em au-dessus et au-dessous d'un bloc question
const IMAGE_MARGIN = 180; // 0,75 rem
const MM = 56.7; // vingtièmes de point par millimètre
const exact = (line: number) => ({ line, lineRule: LineRuleType.EXACT });

/** "2026-09-30" devient "30 septembre 2026". */
function formatDate(iso: unknown): string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
const NUMBERING_REF = "numbered";

type Context = {
  listLevel: number;
  ordered: boolean;
  numberingInstance: number;
  /** Dans un bloc question ou sujet (null sinon). */
  block: "question" | "sujet" | null;
  inHeader: boolean;
};

let instanceCounter = 0;
/** "color" : texte dans la couleur de son auteur ; "black" : tout en noir. */
export type ColorMode = "color" | "black";
let colorMode: ColorMode = "black";
let authorColors = new Map<string, string>();

/** Images du document, téléchargées avant de construire le fichier (adresse vers données et taille). */
export type LoadedImage = { data: ArrayBuffer; type: "jpg" | "png" | "gif"; width: number; height: number };
let loadedImages = new Map<string, LoadedImage>();
// Largeur utile d'une page A4 avec les marges par défaut, en pixels.
const IMAGE_MAX_WIDTH = 600;
const IMAGE_MAX_HEIGHT = 800;

function runs(node: JSONContent, ctx: Context): TextRun[] {
  const result: TextRun[] = [];
  for (const child of node.content ?? []) {
    if (child.type === "hardBreak") {
      result.push(new TextRun({ text: "", break: 1, color: BLACK }));
      continue;
    }
    if (child.type !== "text" || !child.text) continue;
    const marks = child.marks ?? [];
    // Le texte barré (effacé par un autre) n'apparaît pas dans la version finale.
    if (marks.some((m) => m.type === "deleted")) continue;
    result.push(
      new TextRun({
        text: child.text,
        bold: ctx.inHeader || marks.some((m) => m.type === "bold") || undefined,
        italics: marks.some((m) => m.type === "italic") || undefined,
        color: textColor(ctx, marks),
      }),
    );
  }
  return result;
}

// Cartes : gris clair (question) ; sujet gris foncé avec texte blanc en couleur, gris moyen en noir et blanc.
function blockFill(kind: "question" | "sujet"): string {
  if (kind === "question") return "F3F3F3";
  return colorMode === "color" ? "3F3F3F" : "D9D9D9";
}

function textColor(ctx: Context, marks: JSONContent["marks"] = []): string {
  if (ctx.block === "sujet") return colorMode === "color" ? "FFFFFF" : BLACK;
  if (ctx.block === "question" || colorMode === "black") return BLACK;
  // Couleur actuelle de l'auteur (sinon celle enregistrée avec le texte), comme dans l'éditeur.
  const author = (marks ?? []).find((m) => m.type === "author");
  const name = typeof author?.attrs?.name === "string" ? author.attrs.name : "";
  const color = authorColors.get(name) ?? (typeof author?.attrs?.color === "string" ? author.attrs.color : "");
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.slice(1).toUpperCase() : BLACK;
}

function blockStyle(kind: "question" | "sujet"): Partial<IParagraphOptions> {
  const fill = blockFill(kind);
  const edge = (space: number) => ({ style: BorderStyle.SINGLE, size: 1, color: fill, space });
  return {
    shading: { type: ShadingType.CLEAR, color: "auto", fill },
    // Retrait intérieur comme à l'écran : 6 px en haut, 8 px en bas, 12 px sur les côtés (en points).
    border: { top: edge(4), bottom: edge(6), left: edge(9), right: edge(9) },
    indent: { left: 120, right: 120 },
  };
}

function paragraphOptions(ctx: Context, listItemFirst: boolean): Partial<IParagraphOptions> {
  const options: Partial<IParagraphOptions> = { spacing: { before: 0, after: 0 } };
  if (ctx.listLevel >= 0 && listItemFirst) {
    if (ctx.ordered) {
      Object.assign(options, {
        numbering: { reference: NUMBERING_REF, level: ctx.listLevel, instance: ctx.numberingInstance },
      });
    } else {
      Object.assign(options, { bullet: { level: ctx.listLevel } });
    }
  } else if (ctx.listLevel >= 0) {
    Object.assign(options, { indent: { left: 720 * (ctx.listLevel + 1) } });
  }
  if (ctx.block) Object.assign(options, blockStyle(ctx.block));
  return options;
}

// Sauts de page de l'écran : le premier paragraphe d'un bloc qui commence une page à l'écran commence aussi
// une page dans Word ("saut de page avant").
let pendingBreak = false;
// Espace au-dessus du bloc (calculé pour chaque bloc du document), posé sur son premier paragraphe.
let pendingBefore: number | null = null;
function para(options: IParagraphOptions): Paragraph {
  let o = options;
  if (pendingBefore !== null) {
    o = { ...o, spacing: { ...o.spacing, before: Math.max(pendingBefore, o.spacing?.before ?? 0) } };
    pendingBefore = null;
  }
  if (pendingBreak) {
    o = { ...o, pageBreakBefore: true };
    pendingBreak = false;
  }
  return new Paragraph(o);
}

/** Marge au-dessus et au-dessous d'un bloc, comme à l'écran. */
function marginTop(node: JSONContent): number {
  if (node.type === "heading") return HEADING[(node.attrs?.level ?? 1) as 1 | 2 | 3]?.margin ?? GAP;
  if (node.type === "question") return QUESTION_MARGIN;
  if (node.type === "image") return IMAGE_MARGIN;
  return GAP;
}
function marginBottom(node: JSONContent): number {
  if (node.type === "question") return QUESTION_MARGIN;
  if (node.type === "image") return IMAGE_MARGIN;
  return 0;
}

const HEADINGS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const;

function blocks(nodes: JSONContent[] | undefined, ctx: Context): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  for (const node of nodes ?? []) {
    switch (node.type) {
      case "paragraph":
        out.push(para({ ...paragraphOptions(ctx, false), children: runs(node, ctx) }));
        break;

      case "heading": {
        const level = (node.attrs?.level ?? 1) as 1 | 2 | 3;
        out.push(
          para({
            ...paragraphOptions(ctx, false),
            heading: HEADINGS[level] ?? HeadingLevel.HEADING_3,
            spacing: { before: 0, after: 0, ...exact(HEADING[level]?.line ?? LINE) },
            children: runs(node, ctx),
          }),
        );
        break;
      }

      case "bulletList":
      case "orderedList": {
        const ordered = node.type === "orderedList";
        const listCtx: Context = {
          ...ctx,
          listLevel: Math.min(ctx.listLevel + 1, 8),
          ordered,
          numberingInstance: ordered ? ++instanceCounter : ctx.numberingInstance,
        };
        for (const item of node.content ?? []) {
          (item.content ?? []).forEach((child, index) => {
            if (child.type === "paragraph") {
              out.push(
                para({
                  ...paragraphOptions(listCtx, index === 0),
                  children: runs(child, listCtx),
                }),
              );
            } else {
              out.push(...blocks([child], listCtx));
            }
          });
        }
        break;
      }

      case "question": {
        const kind = node.attrs?.kind === "sujet" ? "sujet" : "question";
        const labelColor = kind === "sujet" && colorMode === "color" ? "BDBDBD" : kind === "sujet" ? "595959" : "737373";
        out.push(
          para({
            ...blockStyle(kind),
            spacing: { before: 0, after: 0, ...exact(300) },
            children: [
              new TextRun({
                text: node.attrs?.kind === "sujet" ? "Sujet" : "Question",
                bold: true,
                size: 16,
                color: labelColor,
              }),
              ...(formatDate(node.attrs?.date)
                ? [new TextRun({ text: `    ${formatDate(node.attrs?.date)}`, size: 16, color: labelColor })]
                : []),
            ],
          }),
        );
        out.push(...blocks(node.content, { ...ctx, block: kind }));
        break;
      }

      case "table":
        out.push(table(node, ctx));
        break;

      case "image": {
        const img = typeof node.attrs?.src === "string" ? loadedImages.get(node.attrs.src) : undefined;
        if (!img) break;
        // Taille choisie dans le document (25, 50, 75 ou 100 % de la largeur de la page).
        const percent = [25, 50, 75, 100].includes(Number(node.attrs?.width)) ? Number(node.attrs?.width) : null;
        // Sans taille choisie : taille d'origine, sans dépasser la page.
        const scale = percent
          ? Math.min((IMAGE_MAX_WIDTH * percent) / 100 / img.width, IMAGE_MAX_HEIGHT / img.height)
          : Math.min(1, IMAGE_MAX_WIDTH / img.width, IMAGE_MAX_HEIGHT / img.height);
        out.push(
          para({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new ImageRun({
                type: img.type,
                data: img.data,
                transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
              }),
            ],
          }),
        );
        break;
      }

      default:
        if (node.content) out.push(...blocks(node.content, ctx));
    }
  }
  return out;
}

function table(node: JSONContent, ctx: Context): Table {
  const rows = (node.content ?? []).map(
    (row) =>
      new TableRow({
        children: (row.content ?? []).map((cell) => {
          const header = cell.type === "tableHeader";
          const children = blocks(cell.content, { ...ctx, listLevel: -1, inHeader: header });
          return new TableCell({
            columnSpan: cell.attrs?.colspan ?? 1,
            rowSpan: cell.attrs?.rowspan ?? 1,
            shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "F2F2F2" } : undefined,
            children: children.length ? children : [new Paragraph({ children: [] })],
          });
        }),
      }),
  );
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function headingStyle(level: 1 | 2 | 3) {
  return { run: { color: BLACK, bold: true, size: HEADING[level].size, font: FONT }, paragraph: { spacing: { before: 0, after: 0, ...exact(HEADING[level].line) } } };
}

/** header : titre et auteurs en haut (feuille principale seulement, comme à l'écran). */
/** legend : les auteurs (membres du groupe) et leur couleur, pour la ligne "Auteurs :". */
export type DocMeta = { title: string; authors: string; header?: boolean; legend?: Array<{ name: string; color: string; label: string }> };

function titlePage(meta: DocMeta): Paragraph[] {
  if (meta.header === false) return [];
  // Mêmes hauteurs qu'à l'écran : titre (1,9 em, gras, lignes de 38 px), 8 px, ligne "Auteurs" (24 px),
  // 20 px, trait, puis 32 px avant le contenu. Le titre peut faire plusieurs lignes, comme à l'écran.
  const title = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0, ...exact(570) },
    children: [new TextRun({ text: meta.title, bold: true, size: 46, color: BLACK })],
  });
  const people = meta.legend ?? [];
  const names =
    colorMode === "color"
      ? people.flatMap((a) => [
          new TextRun({ text: "   \u25A0 ", size: 24, color: a.color.slice(1).toUpperCase() }),
          new TextRun({ text: a.name, size: 24, color: a.color.slice(1).toUpperCase() }),
        ])
      : [new TextRun({ text: " " + people.map((a) => a.name).join(", "), size: 24, color: BLACK })];
  const authors = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 480, ...exact(360) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E5E5", space: 15 } },
    children: [new TextRun({ text: "Auteurs :", size: 24, color: BLACK }), ...names],
  });
  return [title, authors];
}

export function buildDocx(
  json: JSONContent,
  meta: DocMeta,
  mode: ColorMode = "black",
  images: Map<string, LoadedImage> = new Map(),
  pageBreaks: number[] = [],
  colors: Map<string, string> = new Map(),
): Document {
  instanceCounter = 0;
  loadedImages = images;
  const breaks = new Set(pageBreaks);
  authorColors = colors;
  let previousBottom = 0;
  colorMode = mode;
  const title = meta.title || "Atelier de groupe";
  const children = [
    ...titlePage(meta),
    // Bloc par bloc, pour placer les sauts de page aux mêmes endroits qu'à l'écran.
    ...(json.content ?? []).flatMap((node, index) => {
      // Espace au-dessus : comme les marges de l'écran (la plus grande des deux), rien en haut d'une page.
      const atTop = index === 0 || breaks.has(index);
      pendingBreak = breaks.has(index);
      pendingBefore = atTop ? 0 : Math.max(previousBottom, marginTop(node));
      const out = blocks([node], { listLevel: -1, ordered: false, numberingInstance: 0, block: null, inHeader: false });
      // Bloc sans paragraphe (tableau) : un paragraphe vide porte le saut de page.
      if (pendingBreak) out.unshift(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 }, children: [] }));
      pendingBreak = false;
      pendingBefore = null;
      previousBottom = marginBottom(node);
      return out;
    }),
  ];

  return new Document({
    creator: "Atelier de groupe",
    title,
    styles: {
      default: {
        document: { run: { font: FONT, size: TEXT_SIZE, color: BLACK }, paragraph: { spacing: exact(LINE) } },
        heading1: headingStyle(1),
        heading2: headingStyle(2),
        heading3: headingStyle(3),
      },
    },
    numbering: {
      config: [
        {
          reference: NUMBERING_REF,
          levels: Array.from({ length: 9 }, (_, level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        // Page A4 avec les mêmes marges qu'à l'écran.
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: Math.round(25 * MM), bottom: Math.round(25 * MM), left: Math.round(20 * MM), right: Math.round(20 * MM), footer: Math.round(10 * MM) },
          },
        },
        // Numéro de page centré en bas de chaque page
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "737373" })],
              }),
            ],
          }),
        },
        children: children.length ? children : [new Paragraph({ children: [] })],
      },
    ],
  });
}

/** Télécharge les images du document (une image introuvable est simplement laissée de côté). */
async function loadImages(json: JSONContent): Promise<Map<string, LoadedImage>> {
  const sources = new Set<string>();
  const walk = (node: JSONContent) => {
    if (node.type === "image" && typeof node.attrs?.src === "string") sources.add(node.attrs.src);
    node.content?.forEach(walk);
  };
  walk(json);
  const map = new Map<string, LoadedImage>();
  await Promise.all(
    [...sources].map(async (src) => {
      try {
        const res = await fetch(src);
        if (!res.ok) return;
        const blob = await res.blob();
        const type = blob.type === "image/png" ? "png" : blob.type === "image/gif" ? "gif" : blob.type === "image/jpeg" ? "jpg" : null;
        if (!type) return;
        const bitmap = await createImageBitmap(blob);
        map.set(src, { data: await blob.arrayBuffer(), type, width: bitmap.width, height: bitmap.height });
        bitmap.close();
      } catch {
        // image manquante : ignorée
      }
    }),
  );
  return map;
}

export async function exportToDocx(
  json: JSONContent,
  meta: DocMeta,
  mode: ColorMode = "black",
  pageBreaks: number[] = [],
  colors: Map<string, string> = new Map(),
): Promise<void> {
  const fileName =
    meta.title.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "gestion-de-projet";
  const blob = await Packer.toBlob(buildDocx(json, meta, mode, await loadImages(json), pageBreaks, colors));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
