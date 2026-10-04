import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getProject } from "@/lib/projects";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { FILE_MAX_BYTES, FILE_PATH, FILE_TYPES } from "@/lib/file-types";

// Envoi d'un fichier : le navigateur l'envoie directement au stockage (jusqu'à 50 Mo),
// avec une autorisation donnée ici seulement aux élèves du projet, pour un emplacement précis.
export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Les fichiers ne sont pas encore activés sur ce site." }, { status: 503 });
  }
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }
  const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const match = pathname.match(FILE_PATH);
        const slug = match?.[1];
        const ext = match?.[3] ?? "";
        const entry = projects.find((p) => p.s === slug);
        if (!match || slug !== clientPayload || !entry || entry.r === "prof" || !(ext in FILE_TYPES)) {
          throw new Error("refusé");
        }
        const project = await getProject(slug);
        if (!project || project.status !== "active") throw new Error("refusé");
        return {
          allowedContentTypes: [FILE_TYPES[ext].mime],
          maximumSizeInBytes: FILE_MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Envoi refusé." }, { status: 403 });
  }
}
