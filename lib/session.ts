import "server-only";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "gp_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours
const MAX_PROJECTS = 30;

/** Projet auquel on a accès : s = adresse (slug), n = nom affiché.
 *  r = "prof" pour un accès par le lien professeur, k = empreinte courte de ce lien (pour pouvoir le révoquer). */
export type SessionProject = { s: string; n: string; r?: "prof"; k?: string };

function getKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(projects: SessionProject[]): Promise<string> {
  return new SignJWT({ p: projects.slice(-MAX_PROJECTS) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getKey());
}

/** Projets de la session, ou [] si le cookie est absent ou invalide. */
export async function readSession(token: string | undefined): Promise<SessionProject[]> {
  if (!token) return [];
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    if (Array.isArray(payload.p)) {
      return payload.p
        .filter((x): x is SessionProject => typeof x?.s === "string" && typeof x?.n === "string")
        .map((x) => (x.r === "prof" && typeof x.k === "string" ? { s: x.s, n: x.n, r: "prof" as const, k: x.k } : { s: x.s, n: x.n }));
    }
    return [];
  } catch {
    return [];
  }
}

export function withProject(projects: SessionProject[], project: SessionProject): SessionProject[] {
  return [...projects.filter((p) => p.s !== project.s), project];
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
