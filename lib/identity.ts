// Palette de 8 couleurs lisibles sur fond blanc. Le noir est réservé aux questions.
export const PALETTE = [
  { value: "#2563eb", label: "Bleu" },
  { value: "#dc2626", label: "Rouge" },
  { value: "#15803d", label: "Vert" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#c2410c", label: "Orange" },
  { value: "#db2777", label: "Rose" },
  { value: "#0f766e", label: "Turquoise" },
  { value: "#a16207", label: "Moutarde" },
] as const;

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

export function loadIdentity(): Identity | null {
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const name = cleanName(parsed?.name);
    if (!name || !isPaletteColor(parsed?.color)) return null;
    return { name, color: parsed.color };
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity): void {
  try {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // stockage indisponible (navigation privée par exemple) : le choix vaut pour la session
  }
}

let memoryUserId: string | null = null;

// Identifiant anonyme et stable par navigateur, utilisé par Liveblocks.
export function getUserId(): string {
  try {
    const existing = window.localStorage.getItem(USER_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(USER_ID_KEY, id);
    return id;
  } catch {
    if (!memoryUserId) memoryUserId = crypto.randomUUID();
    return memoryUserId;
  }
}
