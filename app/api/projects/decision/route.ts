import { NextResponse, type NextRequest } from "next/server";
import { readJson } from "@/lib/request";
import { readDecisionToken } from "@/lib/decision";
import { approveProject, getProject, refuseProject } from "@/lib/projects";
import { sendAcceptedMail, sendRefusedMail } from "@/lib/mail";

// Décision de l'administrateur (depuis le lien reçu par e-mail) : accepter ou refuser.
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const slug = await readDecisionToken(body.token);
  if (!slug) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 });
  if (body.action !== "accept" && body.action !== "refuse") {
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }

  const project = await getProject(slug).catch(() => null);
  if (!project) return NextResponse.json({ error: "Cette demande n'existe plus." }, { status: 404 });
  if (project.status !== "pending") {
    return NextResponse.json({ error: "Cette demande a déjà été acceptée." }, { status: 409 });
  }
  const email = project.request?.email ?? "";

  if (body.action === "refuse") {
    try {
      await refuseProject(slug);
    } catch {
      return NextResponse.json({ error: "Action impossible pour le moment." }, { status: 502 });
    }
    const mailed = email ? await sendRefusedMail(email, project.name) : false;
    return NextResponse.json({ ok: true, action: "refuse", mailed });
  }

  try {
    await approveProject(slug);
  } catch {
    return NextResponse.json({ error: "Action impossible pour le moment." }, { status: 502 });
  }
  const loginUrl = `${request.nextUrl.origin}/?projet=${encodeURIComponent(slug)}`;
  const password = project.password;
  const mailed = email && password ? await sendAcceptedMail(email, project.name, password, loginUrl) : false;

  // E-mail impossible (pas encore de domaine d'envoi) : l'administrateur voit les infos une fois,
  // pour les transmettre lui-même.
  return NextResponse.json({
    ok: true,
    action: "accept",
    mailed,
    ...(mailed ? {} : { handover: { name: project.name, password, email, loginUrl } }),
  });
}
