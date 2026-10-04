import { NextResponse, type NextRequest } from "next/server";
import { getProject, isValidSlug, sameKey, teacherKeyTag } from "@/lib/projects";
import { getIp, readJson } from "@/lib/request";
import { blockedSeconds, registerFailure, registerSuccess } from "@/lib/rate-limit";
import { SESSION_COOKIE, createSessionToken, readSession, sessionCookieOptions, withProject } from "@/lib/session";

const WRONG = "Ce lien professeur n'est pas (ou plus) valable. Demande un nouveau lien au groupe.";

// Ouverture d'un projet par le lien professeur (la clé vient de la fin du lien, après #).
export async function POST(request: NextRequest) {
  if (!process.env.AUTH_SECRET || !process.env.LIVEBLOCKS_SECRET_KEY) {
    return NextResponse.json({ error: "Serveur mal configuré." }, { status: 500 });
  }
  const ip = getIp(request);
  const limitKey = `prof|${ip}`;
  const blocked = blockedSeconds(limitKey);
  if (blocked > 0) {
    return NextResponse.json({ error: `Trop d'essais. Réessaie dans ${Math.ceil(blocked / 60)} min.` }, { status: 429 });
  }

  const body = await readJson(request);
  const slug = typeof body.slug === "string" ? body.slug : "";
  const key = typeof body.key === "string" ? body.key.slice(0, 100) : "";
  if (!isValidSlug(slug) || !key) {
    registerFailure(limitKey);
    return NextResponse.json({ error: WRONG }, { status: 401 });
  }

  let project;
  try {
    project = await getProject(slug);
  } catch {
    return NextResponse.json({ error: "Connexion impossible pour le moment." }, { status: 502 });
  }
  if (!project || project.status !== "active" || !project.teacherKey || !sameKey(key, project.teacherKey)) {
    registerFailure(limitKey);
    return NextResponse.json({ error: WRONG }, { status: 401 });
  }
  registerSuccess(limitKey);

  // Le lien ouvre toujours le projet en mode professeur, même si cet appareil y était déjà comme élève
  // (pour revenir comme élève : "Se déconnecter", puis rejoindre avec le mot de passe).
  const current = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const projects = withProject(current, { s: project.slug, n: project.name, r: "prof", k: teacherKeyTag(project.teacherKey) });
  const response = NextResponse.json({ ok: true, slug: project.slug });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(projects), sessionCookieOptions);
  return response;
}
