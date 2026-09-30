import "server-only";
import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { Liveblocks, LiveblocksError } from "@liveblocks/node";
import { open, seal } from "./secret-box";

// Projets stockés comme salons Liveblocks : le nom et l'empreinte du mot de passe sont
// rangés dans les informations privées du salon (lisibles seulement avec la clé secrète).

export const NAME_MIN = 3;
export const NAME_MAX = 40;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 100;

// Ancien projet unique : garde son adresse et accepte SITE_PASSWORD jusqu'à sa première connexion.
export const LEGACY_SLUG = "gestionprojet";

let client: Liveblocks | null = null;

export function getLiveblocks(): Liveblocks {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) throw new Error("LIVEBLOCKS_SECRET_KEY manquant.");
  if (!client) client = new Liveblocks({ secret });
  return client;
}

/** "Gestion de projet 2" devient "gestion-de-projet-2". */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, NAME_MAX);
}

export function cleanProjectName(name: unknown): string {
  return typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : "";
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= NAME_MIN && slug.length <= NAME_MAX && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/** Message d'erreur si le nom ne convient pas, sinon null. */
export function nameError(name: string): string | null {
  if (name.length < NAME_MIN) return `Le nom doit faire au moins ${NAME_MIN} caractères.`;
  if (!isValidSlug(slugify(name))) return "Utilise des lettres ou des chiffres.";
  if (slugify(name).startsWith("gestionprojet-test")) return "Ce nom est réservé.";
  return null;
}

export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`;
  if (password.length > PASSWORD_MAX) return "Le mot de passe est trop long.";
  return null;
}

// Empreinte scrypt : "s1$sel$empreinte" (le mot de passe n'est jamais stocké).
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `s1$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [version, saltB64, keyB64] = stored.split("$");
  if (version !== "s1" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await derive(password, Buffer.from(saltB64, "base64"));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Comparaison à temps constant de deux textes (pour l'ancien mot de passe commun). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export type ProjectStatus = "pending" | "active";

/** Infos de la demande de création (visibles seulement côté serveur). */
export type ProjectRequest = {
  requester: string;
  email: string;
  school: string;
  className: string;
  course: string;
  message: string;
  requestedAt: string;
};

export type Project = {
  slug: string;
  name: string;
  hash: string | null;
  status: ProjectStatus;
  request: ProjectRequest | null;
  /** Mot de passe déchiffré (pour l'e-mail d'acceptation et "mot de passe oublié"), ou null. */
  password: string | null;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Projet existant (ou null). `hash` est null pour un salon sans mot de passe enregistré. */
function toProject(slug: string, meta: Record<string, unknown>): Project {
  const name = str(meta.gpName) || slug;
  const hash = str(meta.gpHash) || null;
  // Pas de statut = ancien projet, considéré comme actif.
  const status: ProjectStatus = meta.gpStatus === "pending" ? "pending" : "active";
  const request = meta.gpEmail
    ? {
        requester: str(meta.gpRequester),
        email: str(meta.gpEmail),
        school: str(meta.gpSchool),
        className: str(meta.gpClass),
        course: str(meta.gpCourse),
        message: str(meta.gpMessage),
        requestedAt: str(meta.gpRequestedAt),
      }
    : null;
  const password = meta.gpPwd ? open(str(meta.gpPwd)) : null;
  return { slug, name, hash, status, request, password };
}

/** Projets créés par cette adresse e-mail (recherche dans les informations privées des salons). */
export async function findProjectsByEmail(email: string): Promise<Project[]> {
  const found: Project[] = [];
  let cursor: string | undefined;
  do {
    const page = await getLiveblocks().getRooms({
      limit: 100,
      startingAfter: cursor,
      query: { metadata: { gpEmail: email.toLowerCase() } },
    });
    for (const room of page.data) found.push(toProject(room.id, room.metadata ?? {}));
    cursor = page.nextCursor ?? undefined;
  } while (cursor && found.length < 50);
  return found;
}

export async function getProject(slug: string): Promise<Project | null> {
  try {
    const room = await getLiveblocks().getRoom(slug);
    return toProject(slug, room.metadata ?? {});
  } catch (error) {
    if (error instanceof LiveblocksError && error.status === 404) return null;
    throw error;
  }
}

/** Crée le projet en attente de validation (le nom est réservé tout de suite). */
export async function requestProject(name: string, password: string, request: ProjectRequest): Promise<Project> {
  const slug = slugify(name);
  const hash = await hashPassword(password);
  await getLiveblocks().createRoom(slug, {
    defaultAccesses: [],
    metadata: {
      gpName: name,
      gpHash: hash,
      gpPwd: seal(password),
      gpStatus: "pending",
      gpRequester: request.requester,
      gpEmail: request.email,
      gpSchool: request.school,
      gpClass: request.className,
      gpCourse: request.course,
      gpMessage: request.message,
      gpRequestedAt: request.requestedAt,
    },
  });
  return { slug, name, hash, status: "pending", request, password };
}

export async function approveProject(slug: string): Promise<void> {
  // Le mot de passe reste chiffré : il sert pour "mot de passe oublié".
  await getLiveblocks().updateRoom(slug, { metadata: { gpStatus: "active" } });
}

export async function refuseProject(slug: string): Promise<void> {
  await getLiveblocks().deleteRoom(slug);
}

export async function setProjectPassword(slug: string, name: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await getLiveblocks().updateRoom(slug, { metadata: { gpName: name, gpHash: hash, gpPwd: seal(password), gpStatus: "active" } });
}
