import { NextResponse, type NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { FILE_PATH, FILE_TYPES } from "@/lib/file-types";
import { checkLinkToken } from "@/lib/file-links";

type Params = { params: Promise<{ token: string; slug: string; name: string }> };

// Fichier lu par la visionneuse Microsoft, avec un lien signé encore valable (10 minutes). Sans session.
export async function GET(_request: NextRequest, { params }: Params) {
  const { token, slug, name } = await params;
  const path = `${slug}/files/${name}`;
  const match = path.match(FILE_PATH);
  if (!match || !(match[3] in FILE_TYPES) || !process.env.BLOB_READ_WRITE_TOKEN || !checkLinkToken(path, token)) {
    return new NextResponse(null, { status: 404 });
  }
  const result = await get(path, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) return new NextResponse(null, { status: 404 });
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": FILE_TYPES[match[3]].mime,
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
