import { NextResponse, type NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { IMAGE_SRC } from "@/lib/image-files";

type Params = { params: Promise<{ slug: string; file: string }> };

// Affiche une image d'un projet, seulement pour les personnes qui ont accès à ce projet (élèves ou professeur).
export async function GET(request: NextRequest, { params }: Params) {
  const { slug, file } = await params;
  if (!IMAGE_SRC.test(`/api/images/${slug}/${file}`) || !process.env.BLOB_READ_WRITE_TOKEN) {
    return new NextResponse(null, { status: 404 });
  }
  const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!projects.some((p) => p.s === slug)) {
    return new NextResponse(null, { status: 403 });
  }

  const result = await get(`${slug}/${file}`, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      // Le fichier ne change jamais (nouveau nom à chaque envoi) : gardé en cache par le navigateur seulement.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
