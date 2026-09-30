import { NextResponse, type NextRequest } from "next/server";
import {
  cleanProjectName,
  getProject,
  nameError,
  passwordError,
  refuseProject,
  requestProject,
  slugify,
} from "@/lib/projects";
import { getIp, readJson } from "@/lib/request";
import { overLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { createDecisionToken } from "@/lib/decision";
import { sendRequestMail } from "@/lib/mail";

function field(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// Demande de création d'un projet : il est réservé "en attente" et l'administrateur reçoit un e-mail.
export async function POST(request: NextRequest) {
  if (!process.env.AUTH_SECRET || !process.env.LIVEBLOCKS_SECRET_KEY) {
    return NextResponse.json({ error: "Serveur mal configuré." }, { status: 500 });
  }
  const ip = getIp(request);
  const body = await readJson(request);

  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json({ error: "Vérification anti-robot échouée. Réessaie.", captcha: true }, { status: 403 });
  }
  if (overLimit(`request|${ip}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de demandes. Réessaie dans une heure." }, { status: 429 });
  }

  const name = cleanProjectName(body.name);
  const password = typeof body.password === "string" ? body.password : "";
  const confirm = typeof body.confirm === "string" ? body.confirm : "";
  const firstName = field(body.firstName, 40);
  const lastName = field(body.lastName, 40);
  const requester = `${firstName} ${lastName}`.trim();
  const email = field(body.email, 120).toLowerCase();
  const school = field(body.school, 100);
  const className = field(body.className, 60);
  const course = field(body.course, 80);
  const message = field(body.message, 240);

  const error =
    nameError(name) ??
    passwordError(password) ??
    (password !== confirm ? "Les deux mots de passe ne sont pas identiques." : null) ??
    (!firstName ? "Indique ton prénom." : null) ??
    (!lastName ? "Indique ton nom." : null) ??
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Adresse e-mail invalide." : null) ??
    (!school ? "Indique ton école." : null) ??
    (!className ? "Indique ta classe." : null) ??
    (!course ? "Indique le cours." : null);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const slug = slugify(name);
  const requestedAt = new Date().toISOString();
  try {
    if (await getProject(slug)) {
      return NextResponse.json({ error: "Ce nom de projet est déjà utilisé." }, { status: 409 });
    }
    await requestProject(name, password, {
      requester,
      email,
      school,
      className,
      course,
      message,
      requestedAt,
    });
  } catch {
    return NextResponse.json({ error: "Impossible d'enregistrer la demande. Réessaie." }, { status: 502 });
  }

  const token = await createDecisionToken(slug);
  const decisionUrl = `${request.nextUrl.origin}/decision?t=${encodeURIComponent(token)}`;
  const sent = await sendRequestMail({ projectName: name, slug, requester, email, school, className, course, message, decisionUrl });
  if (!sent) {
    // Sans e-mail, personne ne pourrait valider : on libère le nom.
    await refuseProject(slug).catch(() => {});
    return NextResponse.json({ error: "L'envoi de la demande a échoué. Réessaie plus tard." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, slug });
}
