import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { cleanName, isPaletteColor } from "@/lib/identity";
import { getLiveblocks } from "@/lib/projects";
import { readJson } from "@/lib/request";

// Donne accès à un salon seulement s'il fait partie des projets de la session.
export async function POST(request: NextRequest) {
  const projects = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!projects.length) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    return NextResponse.json({ error: "Serveur mal configuré." }, { status: 500 });
  }

  const body = await readJson(request);
  const room = typeof body.room === "string" ? body.room : "";
  if (!projects.some((p) => p.s === room)) {
    return NextResponse.json({ error: "Accès refusé à ce projet." }, { status: 403 });
  }

  const userId =
    typeof body.userId === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(body.userId)
      ? body.userId
      : crypto.randomUUID();
  const name = cleanName(body.name) || "Invité";
  const color = isPaletteColor(body.color) ? body.color : "#6b7280";

  const session = getLiveblocks().prepareSession(userId, { userInfo: { name, color } });
  session.allow(room, session.FULL_ACCESS);
  const { status, body: responseBody } = await session.authorize();
  return new NextResponse(responseBody, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
