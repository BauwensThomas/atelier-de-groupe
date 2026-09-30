import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

// Déconnexion de cet appareil : oublie tous les projets (le mot de passe sera redemandé).
// On reste membre des projets : rien n'est modifié dans les documents.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
