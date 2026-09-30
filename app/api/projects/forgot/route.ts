import { NextResponse, type NextRequest } from "next/server";
import { findProjectsByEmail } from "@/lib/projects";
import { getIp, readJson } from "@/lib/request";
import { overLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendPasswordMail } from "@/lib/mail";

// Mot de passe oublié : on saisit l'e-mail de la personne qui a créé le projet ; elle reçoit
// le nom et le mot de passe de tous ses projets. La réponse est toujours la même, pour ne rien révéler.
const DONE =
  "Si cette adresse a créé un projet, un e-mail avec le nom et le mot de passe vient de lui être envoyé. Pense à regarder les spams.";

export async function POST(request: NextRequest) {
  const ip = getIp(request);
  const body = await readJson(request);

  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json({ error: "Vérification anti-robot échouée. Réessaie.", captcha: true }, { status: 403 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 120) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  if (overLimit(`forgot|${ip}`, 5, 60 * 60 * 1000) || overLimit(`forgot-email|${email}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de demandes. Réessaie dans une heure." }, { status: 429 });
  }

  const projects = await findProjectsByEmail(email).catch(() => []);
  const entries = projects
    .filter((p) => p.status === "active" && p.password)
    .map((p) => ({
      name: p.name,
      password: p.password as string,
      loginUrl: `${request.nextUrl.origin}/?projet=${encodeURIComponent(p.slug)}`,
    }));
  if (entries.length) await sendPasswordMail(email, entries);
  return NextResponse.json({ ok: true, message: DONE });
}
