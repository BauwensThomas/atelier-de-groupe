import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { Liveblocks, LiveblocksError } from "@liveblocks/node";
import { open, seal } from "./secret-box";

// Projets stockés comme salons Liveblocks : le nom et l'empreinte du mot de passe sont
// rangés dans les informations privées du salon (lisibles seulement avec la clé secrète).

export const NAME_MIN = 3;
export const NAME_MAX = 40;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 100;


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
  /** Clé du lien professeur (déchiffrée), ou null si aucun lien n'a été créé. */
  teacherKey: string | null;
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
  const teacherKey = meta.gpProf ? open(str(meta.gpProf)) : null;
  return { slug, name, hash, status, request, password, teacherKey };
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
  return { slug, name, hash, status: "pending", request, password, teacherKey: null };
}

export async function approveProject(slug: string): Promise<void> {
  // Le mot de passe reste chiffré : il sert pour "mot de passe oublié".
  await getLiveblocks().updateRoom(slug, { metadata: { gpStatus: "active" } });
}

export async function refuseProject(slug: string): Promise<void> {
  await getLiveblocks().deleteRoom(slug);
  // Salon des commentaires (créé seulement si quelqu'un a ouvert le projet).
  await getLiveblocks().deleteRoom(`${slug}--notes`).catch(() => {});
}

// Lien professeur : une clé aléatoire, gardée chiffrée dans les informations privées du salon.

/** Crée (ou remplace) la clé du lien professeur. L'ancienne clé ne marche plus. */
export async function renewTeacherKey(slug: string): Promise<string> {
  const key = randomBytes(24).toString("base64url");
  await getLiveblocks().updateRoom(slug, { metadata: { gpProf: seal(key) } });
  return key;
}

/** Empreinte courte de la clé, gardée dans la session du professeur. */
export function teacherKeyTag(key: string): string {
  return createHash("sha256").update(`gp-prof:${key}`).digest("base64url").slice(0, 16);
}

export function sameKey(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

