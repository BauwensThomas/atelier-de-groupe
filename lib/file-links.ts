import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Liens secrets et temporaires vers un fichier, pour la visionneuse Microsoft (qui ne peut pas se connecter).
// Le lien est signé avec une clé dérivée de AUTH_SECRET et ne marche que 10 minutes.

export const LINK_TTL_MS = 10 * 60 * 1000;

function sign(path: string, expires: number): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET manquant ou trop court.");
  return createHmac("sha256", `gp-file-link:${secret}`).update(`${path}|${expires}`).digest("base64url");
}

/** Jeton "<expiration>.<signature>" pour ce fichier (le point ne peut pas apparaître dans la signature). */
export function createLinkToken(path: string): string {
  const expires = Date.now() + LINK_TTL_MS;
  return `${expires.toString(36)}.${sign(path, expires)}`;
}

export function checkLinkToken(path: string, token: string): boolean {
  const [exp, signature] = token.split(".");
  const expires = parseInt(exp ?? "", 36);
  if (!signature || !Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = Buffer.from(sign(path, expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
