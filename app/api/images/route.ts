import { NextResponse, type NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { getProject } from "@/lib/projects";
import { getIp } from "@/lib/request";
import { overLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { IMAGE_MAX_BYTES, IMAGE_TYPES, sniffImage } from "@/lib/image-files";

// Envoi d'une image dans un projet. Stockage privé (Vercel Blob) : l'image n'est lisible
// qu'à travers /api/images/<projet>/<fichier>, qui vérifie la session.
export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Les images ne sont pas encore activées sur ce site." }, { status: 503 });
  }
  if (overLimit(`image|${getIp(request)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop d'images envoyées. Réessaie dans quelques minutes." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envoi invalide." }, { status: 400 });
  }
  const slug = typeof form.get("slug") === "string" ? String(form.get("slug")) : "";
  const file = form.get("file");

  const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const entry = projects.find((p) => p.s === slug);
  // Le professeur lit seulement : il n'ajoute pas d'image.
  if (!entry || entry.r === "prof") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 });
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Image trop lourde (4 Mo maximum)." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(bytes);
  if (!ext) {
    return NextResponse.json({ error: "Formats acceptés : JPG, PNG ou GIF." }, { status: 415 });
  }

  const project = await getProject(slug).catch(() => null);
  if (!project || project.status !== "active") {
    return NextResponse.json({ error: "Ce projet n'existe plus." }, { status: 404 });
  }

  const name = `${crypto.randomUUID()}.${ext}`;
  try {
    await put(`${slug}/${name}`, Buffer.from(bytes), {
      access: "private",
      contentType: IMAGE_TYPES[ext],
      addRandomSuffix: false,
    });
  } catch {
    return NextResponse.json({ error: "Envoi de l'image impossible. Réessaie." }, { status: 502 });
  }
  return NextResponse.json({ src: `/api/images/${slug}/${name}` });
}
