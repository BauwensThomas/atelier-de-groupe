import { NextResponse, type NextRequest } from "next/server";
import { cleanProjectName, getProject, nameError, slugify } from "@/lib/projects";
import { getIp } from "@/lib/request";
import { overLimit } from "@/lib/rate-limit";

// Vérifie si un nom de projet est libre (pour le formulaire de demande).
export async function GET(request: NextRequest) {
  if (overLimit(`check|${getIp(request)}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: "Trop de vérifications, patiente un peu." }, { status: 429 });
  }
  const name = cleanProjectName(request.nextUrl.searchParams.get("name"));
  const error = nameError(name);
  const slug = slugify(name);
  if (error) return NextResponse.json({ slug, available: false, error });
  try {
    const project = await getProject(slug);
    return NextResponse.json({ slug, available: !project });
  } catch {
    return NextResponse.json({ error: "Vérification impossible pour le moment." }, { status: 502 });
  }
}
