import { NextResponse, type NextRequest } from "next/server";
import { readJson } from "@/lib/request";
import { SESSION_COOKIE, createSessionToken, readSession, sessionCookieOptions } from "@/lib/session";

// Quitter un projet sur cet appareil (il faudra le mot de passe pour revenir).
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const slug = typeof body.slug === "string" ? body.slug : "";
  const projects = (await readSession(request.cookies.get(SESSION_COOKIE)?.value)).filter((p) => p.s !== slug);
  const response = NextResponse.json({ ok: true });
  if (projects.length) {
    response.cookies.set(SESSION_COOKIE, await createSessionToken(projects), sessionCookieOptions);
  } else {
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  }
  return response;
}
