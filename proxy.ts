import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";

// Pages de projet (/p/nom) : accessibles seulement après avoir rejoint le projet.
// L'accueil, la page de décision et les routes /api/projects sont publics.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login") return NextResponse.redirect(new URL("/", request.url));

  const match = pathname.match(/^\/p\/([^/]+)\/?$/);
  if (match) {
    const slug = decodeURIComponent(match[1]);
    const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
    if (projects.some((p) => p.s === slug)) return NextResponse.next();
    const url = new URL("/", request.url);
    url.searchParams.set("projet", slug);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/p/:path*"],
};
