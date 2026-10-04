import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { PROF_COLOR, cleanName, isPaletteColor } from "@/lib/identity";
import { getLiveblocks, getProject, teacherKeyTag } from "@/lib/projects";
import { readJson } from "@/lib/request";

// Donne accès à un salon seulement s'il fait partie des projets de la session.
export async function POST(request: NextRequest) {
  const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!projects.length) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    return NextResponse.json({ error: "Serveur mal configuré." }, { status: 500 });
  }

  const body = await readJson(request);
  const room = typeof body.room === "string" ? body.room : "";
  // Salon des commentaires d'un projet : "<projet>--notes" (un nom de projet ne contient jamais "--").
  const isNotes = room.endsWith("--notes");
  const slug = isNotes ? room.slice(0, -"--notes".length) : room;
  const entry = projects.find((p) => p.s === slug);
  if (!entry) {
    return NextResponse.json({ error: "Accès refusé à ce projet." }, { status: 403 });
  }

  // Ne jamais ouvrir (ni recréer) le salon d'un projet supprimé ou en attente.
  const project = await getProject(slug).catch(() => null);
  if (!project || project.status !== "active") {
    return NextResponse.json({ error: "Ce projet n'existe plus." }, { status: 404 });
  }
  // Professeur : le lien doit toujours être le bon (un "nouveau lien" coupe l'accès de l'ancien).
  const prof = entry.r === "prof";
  if (prof && (!project.teacherKey || teacherKeyTag(project.teacherKey) !== entry.k)) {
    return NextResponse.json({ error: "Ce lien professeur n'est plus valable." }, { status: 403 });
  }

  const userId =
    typeof body.userId === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(body.userId)
      ? body.userId
      : crypto.randomUUID();
  const name = cleanName(body.name) || "Invité";
  // Couleur du professeur imposée par le serveur ; un élève ne peut pas la prendre.
  const color = prof ? PROF_COLOR : isPaletteColor(body.color) ? body.color : "#6b7280";

  const session = getLiveblocks().prepareSession(userId, { userInfo: { name, color } });
  // Le professeur lit le document sans pouvoir le modifier ; il écrit seulement dans les commentaires.
  session.allow(room, prof && !isNotes ? session.READ_ACCESS : session.FULL_ACCESS);
  const { status, body: responseBody } = await session.authorize();
  return new NextResponse(responseBody, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
