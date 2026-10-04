import { NextResponse, type NextRequest } from "next/server";
import { cleanupUnusedImages } from "@/lib/image-cleanup";
import { getProject } from "@/lib/projects";
import { readJson } from "@/lib/request";
import { SESSION_COOKIE, readSession } from "@/lib/session";

// Nettoyage des images inutilisées d'un projet, demandé de temps en temps par le navigateur d'un élève.
const lastRun = new Map<string, number>();
const EVERY_MS = 6 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const slug = typeof body.slug === "string" ? body.slug : "";
  const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const entry = projects.find((p) => p.s === slug);
  if (!entry || entry.r === "prof") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  // Au plus une fois toutes les 6 heures par projet.
  const now = Date.now();
  if (now - (lastRun.get(slug) ?? 0) < EVERY_MS) return NextResponse.json({ removed: 0 });
  lastRun.set(slug, now);

  try {
    const project = await getProject(slug);
    if (!project || project.status !== "active") return NextResponse.json({ removed: 0 });
    return NextResponse.json({ removed: await cleanupUnusedImages(slug) });
  } catch {
    return NextResponse.json({ error: "Nettoyage impossible pour le moment." }, { status: 502 });
  }
}
