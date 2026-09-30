import { NextResponse, type NextRequest } from "next/server";
import { cleanProjectName, getProject, slugify, verifyPassword } from "@/lib/projects";
import { getIp, readJson } from "@/lib/request";
import { blockedSeconds, failureCount, registerFailure, registerSuccess } from "@/lib/rate-limit";
import { turnstileEnabled, verifyTurnstile } from "@/lib/turnstile";
import { SESSION_COOKIE, createSessionToken, readSession, sessionCookieOptions, withProject } from "@/lib/session";

const CAPTCHA_AFTER = 3; // échecs avant de demander la vérification anti-robot
const WRONG = "Nom de projet ou mot de passe incorrect.";

// Rejoindre un projet : nom (ou adresse) + mot de passe.
export async function POST(request: NextRequest) {
  if (!process.env.AUTH_SECRET || !process.env.LIVEBLOCKS_SECRET_KEY) {
    return NextResponse.json({ error: "Serveur mal configuré." }, { status: 500 });
  }
  const ip = getIp(request);
  const body = await readJson(request);
  const slug = slugify(cleanProjectName(body.name));
  const password = typeof body.password === "string" ? body.password : "";
  const key = `join|${ip}|${slug}`;

  const blocked = blockedSeconds(key);
  if (blocked > 0) {
    return NextResponse.json(
      { error: `Trop d'essais. Réessaie dans ${Math.ceil(blocked / 60)} min.` },
      { status: 429 },
    );
  }
  const needCaptcha = turnstileEnabled() && failureCount(key) >= CAPTCHA_AFTER;
  if (needCaptcha && !(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json({ error: "Confirme que tu n'es pas un robot.", captcha: true }, { status: 403 });
  }
  if (!slug || !password) {
    registerFailure(key);
    return NextResponse.json({ error: WRONG }, { status: 401 });
  }

  let project;
  try {
    project = await getProject(slug);
  } catch {
    return NextResponse.json({ error: "Connexion impossible pour le moment." }, { status: 502 });
  }

  const ok = project?.hash ? await verifyPassword(password, project.hash) : false;

  if (!project || !ok) {
    registerFailure(key);
    const captcha = turnstileEnabled() && failureCount(key) >= CAPTCHA_AFTER;
    return NextResponse.json({ error: WRONG, captcha }, { status: 401 });
  }
  registerSuccess(key);

  if (project.status === "pending") {
    return NextResponse.json({ error: "Ce projet attend encore une validation." }, { status: 403 });
  }

  const projects = withProject(await readSession(request.cookies.get(SESSION_COOKIE)?.value), {
    s: project.slug,
    n: project.name,
  });
  const response = NextResponse.json({ ok: true, slug: project.slug });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(projects), sessionCookieOptions);
  return response;
}
