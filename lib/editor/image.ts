import Image from "@tiptap/extension-image";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { isImageSrc } from "@/lib/image-files";

// Images du document : seulement celles envoyées dans le projet (/api/images/...).
// Une image collée depuis un autre site est ignorée (pas de suivi par des sites extérieurs).

/** Tailles proposées, en pourcentage de la largeur de la page. */
export const IMAGE_SIZES = [
  { value: 25, label: "Petite" },
  { value: 50, label: "Moyenne" },
  { value: 75, label: "Grande" },
  { value: 100, label: "Pleine largeur" },
] as const;

/** Taille choisie, ou null : taille d'origine (sans dépasser la largeur de la page). */
export function imageWidth(value: unknown): number | null {
  const n = Number(value);
  return value !== null && value !== undefined && IMAGE_SIZES.some((s) => s.value === n) ? n : null;
}

type Options = {
  /** Envoie le fichier et renvoie l'adresse de l'image, ou null en cas d'échec. Absent : images désactivées. */
  upload?: (file: File) => Promise<string | null>;
};

function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
}

async function insertFiles(view: EditorView, files: File[], pos: number | null, upload: (file: File) => Promise<string | null>) {
  for (const file of files) {
    const src = await upload(file);
    if (!src || view.isDestroyed || !view.editable) continue;
    const node = view.state.schema.nodes.image.create({ src, alt: file.name.replace(/\.[^.]+$/, "").slice(0, 100) });
    try {
      const tr = pos === null ? view.state.tr.replaceSelectionWith(node) : view.state.tr.insert(Math.min(pos, view.state.doc.content.size), node);
      view.dispatch(tr.scrollIntoView());
    } catch {
      // position impossible (dans un tableau par exemple) : on ajoute l'image à la fin du document
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, node).scrollIntoView());
    }
    pos = null;
  }
}

export const DocImage = Image.extend<Options>({
  draggable: true,

  addOptions() {
    return { ...this.parent?.(), inline: false, allowBase64: false, HTMLAttributes: {}, upload: undefined };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => imageWidth(el.getAttribute("data-width")),
        renderHTML: (attrs) => (imageWidth(attrs.width) ? { "data-width": String(attrs.width) } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]", getAttrs: (el) => (isImageSrc((el as HTMLElement).getAttribute("src")) ? null : false) }];
  },

  renderHTML({ HTMLAttributes }) {
    const src = isImageSrc(HTMLAttributes.src) ? HTMLAttributes.src : "";
    const width = imageWidth(HTMLAttributes["data-width"]);
    return [
      "img",
      {
        src,
        alt: typeof HTMLAttributes.alt === "string" ? HTMLAttributes.alt : "",
        loading: "lazy",
        draggable: "true",
        ...(width ? { "data-width": String(width), style: `width: ${width}%` } : {}),
      },
    ];
  },

  addProseMirrorPlugins() {
    const upload = this.options.upload;
    if (!upload) return [];
    return [
      new Plugin({
        key: new PluginKey("gp-image-drop"),
        props: {
          handlePaste(view, event) {
            const files = imageFiles(event.clipboardData?.files);
            if (!files.length || !view.editable) return false;
            event.preventDefault();
            void insertFiles(view, files, null, upload);
            return true;
          },
          handleDrop(view, event) {
            const files = imageFiles(event.dataTransfer?.files);
            if (!files.length || !view.editable) return false;
            event.preventDefault();
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null;
            void insertFiles(view, files, pos, upload);
            return true;
          },
        },
      }),
    ];
  },
});

/** Bouton "Image" de la barre d'outils : choisir un fichier puis l'insérer au curseur. */
export function pickAndInsertImage(view: EditorView, upload: (file: File) => Promise<string | null>) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/gif,image/webp";
  input.multiple = true;
  input.onchange = () => {
    void insertFiles(view, imageFiles(input.files), null, upload);
  };
  input.click();
}
