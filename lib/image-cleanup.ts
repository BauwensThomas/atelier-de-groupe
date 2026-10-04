import "server-only";
import * as Y from "yjs";
import { del, list } from "@vercel/blob";
import { getLiveblocks } from "./projects";

// Nettoyage du stockage d'un projet (images du texte et fichiers joints).
// Une image retirée peut revenir (Ctrl+Z, restauration d'une version) : on n'efface que celles qui ne
// sont plus utilisées nulle part (toutes les feuilles, même supprimées, et les versions) et envoyées depuis
// plus de 7 jours. Un fichier joint est gardé tant qu'il est dans la liste des fichiers.

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const FILE = /\/api\/images\/[a-z0-9-]+\/([0-9a-f-]{36}\.(?:jpg|png|gif))/g;

function enabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function projectBlobs(slug: string) {
  const blobs: Array<{ url: string; pathname: string; uploadedAt: Date }> = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `${slug}/`, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

/** Fichiers encore utilisés : images des feuilles et des versions ("<id>.png"), fichiers joints ("files/<id>.pdf"). */
async function usedFiles(slug: string): Promise<Set<string>> {
  const update = await getLiveblocks().getYjsDocumentAsBinaryUpdate(slug);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(update));
  const sheets = ["default", ...[...doc.getMap("sheets").keys()].filter((id) => id !== "main").map((id) => `sheet-${id}`)];
  const text = sheets.map((name) => doc.getXmlFragment(name).toString()).join("") + JSON.stringify(doc.getArray("versions").toJSON());
  const used = new Set([...text.matchAll(FILE)].map((m) => m[1]));
  doc.getMap("files").forEach((value) => {
    const path = (value as { path?: unknown } | null)?.path;
    if (typeof path === "string" && path.startsWith(`${slug}/`)) used.add(path.slice(slug.length + 1));
  });
  doc.destroy();
  return used;
}

/** Efface les images inutilisées du projet. Renvoie le nombre d'images effacées. */
export async function cleanupUnusedImages(slug: string): Promise<number> {
  if (!enabled()) return 0;
  const blobs = await projectBlobs(slug);
  if (!blobs.length) return 0;
  const used = await usedFiles(slug);
  const old = Date.now() - GRACE_MS;
  const unused = blobs.filter((b) => !used.has(b.pathname.slice(slug.length + 1)) && b.uploadedAt.getTime() < old);
  if (unused.length) await del(unused.map((b) => b.url));
  return unused.length;
}

/** Projet supprimé : toutes ses images partent avec lui. */
export async function deleteAllImages(slug: string): Promise<void> {
  if (!enabled()) return;
  const blobs = await projectBlobs(slug);
  if (blobs.length) await del(blobs.map((b) => b.url));
}
