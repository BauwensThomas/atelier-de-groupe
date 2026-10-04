// Fichiers joints à un projet : types acceptés et façon de les afficher (navigateur et serveur).

export const FILE_MAX_BYTES = 50 * 1024 * 1024;

export type FileKind = "image" | "pdf" | "word" | "excel" | "powerpoint" | "text" | "other";

type FileType = { mime: string; kind: FileKind };

export const FILE_TYPES: Record<string, FileType> = {
  png: { mime: "image/png", kind: "image" },
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  gif: { mime: "image/gif", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  pdf: { mime: "application/pdf", kind: "pdf" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "word" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "excel" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "powerpoint" },
  // Anciens formats et OpenDocument : téléchargement (et aperçu quand c'est possible).
  doc: { mime: "application/msword", kind: "other" },
  xls: { mime: "application/vnd.ms-excel", kind: "excel" },
  ppt: { mime: "application/vnd.ms-powerpoint", kind: "other" },
  odt: { mime: "application/vnd.oasis.opendocument.text", kind: "other" },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", kind: "excel" },
  odp: { mime: "application/vnd.oasis.opendocument.presentation", kind: "other" },
  csv: { mime: "text/csv", kind: "excel" },
  txt: { mime: "text/plain", kind: "text" },
};

export const ALLOWED_MIMES = [...new Set(Object.values(FILE_TYPES).map((t) => t.mime))];

/** "Rapport final.DOCX" donne "docx" (ou null si le type n'est pas accepté). */
export function fileExt(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ext in FILE_TYPES ? ext : null;
}

/** Fichiers Office affichables par la visionneuse Microsoft, avec sa taille maximale (Excel : 5 Mo). */
export function officeLimit(ext: string): number | null {
  if (ext === "xls" || ext === "xlsx") return 5 * 1024 * 1024;
  if (["doc", "docx", "ppt", "pptx"].includes(ext)) return 10 * 1024 * 1024;
  return null;
}

/** Emplacement de stockage : <projet>/files/<identifiant>.<ext> */
export const FILE_PATH = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/files\/([0-9a-f-]{36}\.([a-z]{3,4}))$/;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
