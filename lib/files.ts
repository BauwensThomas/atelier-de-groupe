"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";
import { upload } from "@vercel/blob/client";
import { FILE_MAX_BYTES, FILE_TYPES, fileExt } from "./file-types";

// Fichiers du projet : la liste est partagée dans le document Yjs, le contenu est dans Vercel Blob (privé).

export type ProjectFile = { id: string; name: string; ext: string; size: number; path: string; t: number; by: string; color: string };

function filesMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("files");
}

export function readFiles(doc: Y.Doc): ProjectFile[] {
  const list: ProjectFile[] = [];
  filesMap(doc).forEach((value, id) => {
    const v = value as Partial<ProjectFile> | null;
    if (!v || typeof v.name !== "string" || typeof v.path !== "string" || typeof v.ext !== "string") return;
    list.push({
      id,
      name: v.name,
      ext: v.ext,
      size: typeof v.size === "number" ? v.size : 0,
      path: v.path,
      t: typeof v.t === "number" ? v.t : 0,
      by: typeof v.by === "string" ? v.by : "",
      color: typeof v.color === "string" ? v.color : "#6b7280",
    });
  });
  return list.sort((a, b) => b.t - a.t);
}

export function useFiles(doc: Y.Doc): ProjectFile[] {
  const [files, setFiles] = useState<ProjectFile[]>(() => readFiles(doc));
  useEffect(() => {
    const map = filesMap(doc);
    const update = () => setFiles(readFiles(doc));
    map.observe(update);
    update();
    return () => map.unobserve(update);
  }, [doc]);
  return files;
}

/** Adresse pour afficher le fichier (download : téléchargement avec son vrai nom). */
export function fileUrl(file: ProjectFile, download = false): string {
  const base = `/api/files/${file.path}`;
  return download ? `${base}?download=1&name=${encodeURIComponent(file.name)}` : base;
}

/** Envoie le fichier directement vers le stockage (jusqu'à 50 Mo), puis l'ajoute à la liste. */
export async function uploadFile(
  doc: Y.Doc,
  slug: string,
  file: File,
  who: { name: string; color: string },
  onProgress: (percent: number) => void,
): Promise<ProjectFile | { error: string }> {
  const ext = fileExt(file.name);
  if (!ext) return { error: `Type de fichier non accepté : ${file.name}` };
  if (file.size > FILE_MAX_BYTES) return { error: `Fichier trop lourd (50 Mo maximum) : ${file.name}` };
  const path = `${slug}/files/${crypto.randomUUID()}.${ext}`;
  try {
    await upload(path, file, {
      access: "private",
      handleUploadUrl: "/api/files/upload",
      clientPayload: slug,
      contentType: FILE_TYPES[ext].mime,
      multipart: file.size > 8 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
    });
  } catch {
    return { error: `Envoi impossible : ${file.name}` };
  }
  const entry: ProjectFile = {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 120),
    ext,
    size: file.size,
    path,
    t: Date.now(),
    by: who.name,
    color: who.color,
  };
  const { id, ...data } = entry;
  filesMap(doc).set(id, data);
  return entry;
}

export async function removeFile(doc: Y.Doc, slug: string, file: ProjectFile): Promise<boolean> {
  const res = await fetch("/api/files/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, path: file.path }),
  }).catch(() => null);
  if (!res?.ok) return false;
  filesMap(doc).delete(file.id);
  return true;
}
