import { NextResponse, type NextRequest } from "next/server";
import { getProject, renewTeacherKey } from "@/lib/projects";
import { readJson } from "@/lib/request";
import { SESSION_COOKIE, readSession } from "@/lib/session";

// Lien professeur d'un projet : réservé aux élèves du projet. renew = true remplace l'ancien lien.
export async function POST(request: NextRequest) {
  if (!process.env.AUTH_SECRET || !process.env.LIVEBLOCKS_SECRET_KEY) {
    return NextResponse.json({ error: "Serveur mal configuré." }, { status: 500 });
  }
  const body = await readJson(request);
  const slug = typeof body.slug === "string" ? body.slug : "";
  const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const entry = projects.find((p) => p.s === slug);
  if (!entry || entry.r === "prof") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  try {
    const project = await getProject(slug);
    if (!project || project.status !== "active") {
      return NextResponse.json({ error: "Ce projet n'existe plus." }, { status: 404 });
    }
    const key = body.renew === true || !project.teacherKey ? await renewTeacherKey(slug) : project.teacherKey;
    return NextResponse.json({ key }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Connexion impossible pour le moment." }, { status: 502 });
  }
}
