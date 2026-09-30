import "server-only";
import { SignJWT, jwtVerify } from "jose";

// Lien de décision envoyé par e-mail à l'administrateur : signé, valable 14 jours.

function getKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET manquant ou trop court.");
  return new TextEncoder().encode(secret);
}

export async function createDecisionToken(slug: string): Promise<string> {
  return new SignJWT({ purpose: "decision", slug })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getKey());
}

export async function readDecisionToken(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    return payload.purpose === "decision" && typeof payload.slug === "string" ? payload.slug : null;
  } catch {
    return null;
  }
}

