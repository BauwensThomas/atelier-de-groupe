// Règles communes aux images (navigateur et serveur).

export const IMAGE_MAX_BYTES = 4 * 1024 * 1024; // limite d'envoi vers Vercel : 4,5 Mo
export const IMAGE_MAX_SIDE = 1600;

export type ImageExt = "jpg" | "png" | "gif";

export const IMAGE_TYPES: Record<ImageExt, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
};

/** Adresse d'une image du projet : /api/images/<projet>/<identifiant>.<jpg|png|gif> */
export const IMAGE_SRC = /^\/api\/images\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([0-9a-f-]{36}\.(?:jpg|png|gif))$/;

export function isImageSrc(src: unknown): src is string {
  return typeof src === "string" && IMAGE_SRC.test(src);
}

/** Type réel d'après les premiers octets du fichier (on ne fait pas confiance au nom du fichier). */
export function sniffImage(bytes: Uint8Array): ImageExt | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "gif";
  return null;
}
