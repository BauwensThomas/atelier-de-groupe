// Palette de 8 couleurs bien distinctes, lisibles sur fond blanc (choisies le 4 octobre 2026) : un seul bleu,
// un seul vert, pas de marron, pas de noir (réservé aux questions), pas de violet ni de rose (le fuchsia est
// réservé au professeur).
export const PALETTE = [
  { value: "#2563eb", label: "Bleu" },
  { value: "#dc2626", label: "Rouge" },
  { value: "#16a34a", label: "Vert" },
  { value: "#ea580c", label: "Orange" },
  { value: "#0891b2", label: "Turquoise" },
  { value: "#ca8a04", label: "Jaune doré" },
  { value: "#f43f5e", label: "Corail" },
  { value: "#6b7280", label: "Gris" },
] as const;

/** Couleur réservée au professeur : absente de la palette, refusée par le serveur pour un élève. */
export const PROF_COLOR = "#c026d3";

export const NAME_MAX = 24;

export type Identity = { name: string; color: string };

export function isPaletteColor(color: unknown): color is string {
  return typeof color === "string" && PALETTE.some((c) => c.value === color);
}

export function cleanName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

const IDENTITY_KEY = "gp.identity";
const USER_ID_KEY = "gp.userId";

// Le professeur a sa propre identité (prénom, couleur, identifiant) : pas de mélange avec un compte élève
// ouvert dans le même navigateur.
const suffix = (prof: boolean) => (prof ? ".prof" : "");

export function loadIdentity(prof = false): Identity | null {
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY + suffix(prof));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const name = cleanName(parsed?.name);
    if (!name) return null;
    // Professeur : toujours sa couleur réservée. Élève : une couleur de la palette.
    if (prof) return { name, color: PROF_COLOR };
    if (!isPaletteColor(parsed?.color)) return null;
    return { name, color: parsed.color };
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity, prof = false): void {
  try {
    window.localStorage.setItem(IDENTITY_KEY + suffix(prof), JSON.stringify(identity));
  } catch {
    // stockage indisponible (navigation privée par exemple) : le choix vaut pour la session
  }
}

const memoryUserId: Record<string, string> = {};

// Identifiant anonyme et stable par navigateur, utilisé par Liveblocks.
export function getUserId(prof = false): string {
  const key = USER_ID_KEY + suffix(prof);
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    memoryUserId[key] ??= crypto.randomUUID();
    return memoryUserId[key];
  }
}
