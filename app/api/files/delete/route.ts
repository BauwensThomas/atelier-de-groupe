import { NextResponse, type NextRequest } from "next/server";
import { del } from "@vercel/blob";
import { readJson } from "@/lib/request";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { FILE_PATH } from "@/lib/file-types";

// Suppression d'un fichier du projet (élèves seulement).
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const slug = typeof body.slug === "string" ? body.slug : "";
  const path = typeof body.path === "string" ? body.path : "";
  const match = path.match(FILE_PATH);
  const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const entry = projects.find((p) => p.s === slug);
  if (!match || match[1] !== slug || !entry || entry.r === "prof") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  try {
    await del(path);
  } catch {
    // déjà effacé : rien à faire
  }
  return NextResponse.json({ ok: true });
}
