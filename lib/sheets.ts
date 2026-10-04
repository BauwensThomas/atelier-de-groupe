"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";

// Feuilles d'un projet : la feuille principale (le document d'origine) et des feuilles blanches en plus.
// Chaque feuille a son propre texte dans le document Yjs. Une feuille supprimée disparaît de la liste,
// mais son contenu est gardé par sécurité.

export const MAIN_SHEET = "main";
export const SHEET_NAME_MAX = 40;
const MAIN_NAME = "Document principal";

export type Sheet = { id: string; name: string; t: number };

function sheetsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("sheets");
}

/** Nom du texte Yjs d'une feuille ("default" pour la principale, celle d'origine). */
export function sheetField(id: string): string {
  return id === MAIN_SHEET ? "default" : `sheet-${id}`;
}

export function readSheets(doc: Y.Doc): Sheet[] {
  const map = sheetsMap(doc);
  const main = map.get(MAIN_SHEET) as { name?: unknown } | undefined;
  const list: Sheet[] = [{ id: MAIN_SHEET, name: typeof main?.name === "string" && main.name ? main.name : MAIN_NAME, t: 0 }];
  map.forEach((value, id) => {
    if (id === MAIN_SHEET) return;
    const v = value as { name?: unknown; t?: unknown; deleted?: unknown } | null;
    if (!v || v.deleted || typeof v.name !== "string") return;
    list.push({ id, name: v.name, t: typeof v.t === "number" ? v.t : 0 });
  });
  return list.sort((a, b) => a.t - b.t);
}

export function useSheets(doc: Y.Doc): Sheet[] {
  const [sheets, setSheets] = useState<Sheet[]>(() => readSheets(doc));
  useEffect(() => {
    const map = sheetsMap(doc);
    const update = () => setSheets(readSheets(doc));
    map.observe(update);
    update();
    return () => map.unobserve(update);
  }, [doc]);
  return sheets;
}

export function cleanSheetName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, SHEET_NAME_MAX);
}

export function addSheet(doc: Y.Doc, name: string): Sheet {
  const sheet = { id: crypto.randomUUID().slice(0, 8), name: cleanSheetName(name) || "Nouvelle feuille", t: Date.now() };
  sheetsMap(doc).set(sheet.id, { name: sheet.name, t: sheet.t });
  return sheet;
}

export function renameSheet(doc: Y.Doc, sheet: Sheet, name: string): void {
  const clean = cleanSheetName(name);
  if (!clean || clean === sheet.name) return;
  sheetsMap(doc).set(sheet.id, sheet.id === MAIN_SHEET ? { name: clean } : { name: clean, t: sheet.t });
}

/** Retire la feuille de la liste (son texte reste dans le projet). */
export function deleteSheet(doc: Y.Doc, sheet: Sheet): void {
  if (sheet.id === MAIN_SHEET) return;
  sheetsMap(doc).set(sheet.id, { name: sheet.name, t: sheet.t, deleted: Date.now() });
}
