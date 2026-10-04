import { NextResponse, type NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { FILE_PATH, FILE_TYPES } from "@/lib/file-types";

type Params = { params: Promise<{ slug: string; name: string }> };

// Lecture d'un fichier du projet, seulement pour les élèves du projet (pas le professeur).
// ?download=1&name=... : téléchargement avec le vrai nom du fichier.
export async function GET(request: NextRequest, { params }: Params) {
  const { slug, name } = await params;
  const path = `${slug}/files/${name}`;
  const match = path.match(FILE_PATH);
  if (!match || !(match[3] in FILE_TYPES) || !process.env.BLOB_READ_WRITE_TOKEN) {
    return new NextResponse(null, { status: 404 });
  }
  const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const entry = projects.find((p) => p.s === slug);
  if (!entry || entry.r === "prof") {
    return new NextResponse(null, { status: 403 });
  }
  const result = await get(path, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) {
    return new NextResponse(null, { status: 404 });
  }

  const type = FILE_TYPES[match[3]];
  const download = request.nextUrl.searchParams.get("download") === "1";
  const wanted = (request.nextUrl.searchParams.get("name") ?? name).replace(/[\r\n"\\/]/g, "").slice(0, 120) || name;
  const headers: Record<string, string> = {
    "Content-Type": type.mime,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${wanted.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(wanted)}`,
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  // Rien d'exécutable : le lecteur PDF du navigateur a besoin de ses scripts, le reste est mis en bac à sable.
  if (type.kind !== "pdf") headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
  return new NextResponse(result.stream, { headers });
}
