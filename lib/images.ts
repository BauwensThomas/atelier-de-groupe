"use client";

import { IMAGE_MAX_BYTES, IMAGE_MAX_SIDE } from "./image-files";

// Préparation dans le navigateur : les grandes photos sont réduites (1600 px au plus) avant l'envoi.

function loadBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function prepare(file: File): Promise<Blob> {
  // GIF (souvent animé) : envoyé tel quel s'il n'est pas trop lourd.
  if (file.type === "image/gif" && file.size <= IMAGE_MAX_BYTES) return file;

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const small = file.size <= 1024 * 1024 && (file.type === "image/png" || file.type === "image/jpeg");
  if (scale === 1 && small) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  // Fond blanc : les zones transparentes ne deviennent pas noires en JPG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Capture d'écran (PNG) : on garde le PNG s'il reste léger (texte plus net), sinon JPG.
  if (file.type === "image/png") {
    const png = await canvasToBlob(canvas, "image/png");
    if (png && png.size <= 1.5 * 1024 * 1024) return png;
  }
  const jpg = await canvasToBlob(canvas, "image/jpeg", 0.85);
  if (!jpg) throw new Error("jpg");
  return jpg;
}

/** Envoie l'image et renvoie son adresse, ou un message d'erreur. */
export async function uploadImage(slug: string, file: File): Promise<{ src: string } | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: "Ce fichier n'est pas une image." };
  let blob: Blob;
  try {
    blob = await prepare(file);
  } catch {
    return { error: "Image illisible. Formats acceptés : JPG, PNG, GIF ou WebP." };
  }
  if (blob.size > IMAGE_MAX_BYTES) return { error: "Image trop lourde (4 Mo maximum)." };

  const form = new FormData();
  form.append("slug", slug);
  form.append("file", blob);
  const res = await fetch("/api/images", { method: "POST", body: form }).catch(() => null);
  const data = res ? ((await res.json().catch(() => ({}))) as { src?: string; error?: string }) : {};
  if (res?.ok && data.src) return { src: data.src };
  return { error: data.error ?? "Envoi impossible. Vérifie ta connexion." };
}
