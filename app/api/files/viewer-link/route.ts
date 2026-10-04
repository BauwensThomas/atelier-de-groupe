import { NextResponse, type NextRequest } from "next/server";
import { readJson } from "@/lib/request";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { FILE_PATH } from "@/lib/file-types";
import { createLinkToken } from "@/lib/file-links";

// Crée un lien temporaire (10 minutes) vers un fichier, pour l'afficher dans la visionneuse Microsoft.
// Réservé aux élèves du projet.
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const path = typeof body.path === "string" ? body.path : "";
  const match = path.match(FILE_PATH);
  const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const entry = match ? projects.find((p) => p.s === match[1]) : undefined;
  if (!match || !entry || entry.r === "prof") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  const url = new URL(`/api/files/link/${createLinkToken(path)}/${match[1]}/${match[2]}`, request.nextUrl.origin);
  return NextResponse.json({ url: url.toString() }, { headers: { "Cache-Control": "no-store" } });
}
