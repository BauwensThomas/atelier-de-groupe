"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";

// Feuilles d'un projet : la feuille principale (le document d'origine) et des feuilles blanches en plus.
// Chaque feuille a son propre texte dans le document Yjs. Une feuille supprimée disparaît de la liste,
// mais son contenu est gardé par sécurité.

export const MAIN_SHEET = "main";
export const SHEET_NAME_MAX = 40;
const MAIN_NAME = "Document principal";

/** order : place de l'onglet (on peut les déplacer) ; t : date de création. */
export type Sheet = { id: string; name: string; t: number; order: number };

function sheetsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("sheets");
}

/** Nom du texte Yjs d'une feuille ("default" pour la principale, celle d'origine). */
export function sheetField(id: string): string {
  return id === MAIN_SHEET ? "default" : `sheet-${id}`;
}

export function readSheets(doc: Y.Doc): Sheet[] {
  const map = sheetsMap(doc);
  const main = map.get(MAIN_SHEET) as { name?: unknown; order?: unknown } | undefined;
  // Sans ordre choisi : la principale d'abord, puis les autres par date de création.
  const list: Sheet[] = [
    { id: MAIN_SHEET, name: typeof main?.name === "string" && main.name ? main.name : MAIN_NAME, t: 0, order: typeof main?.order === "number" ? main.order : -1 },
  ];
  map.forEach((value, id) => {
    if (id === MAIN_SHEET) return;
    const v = value as { name?: unknown; t?: unknown; deleted?: unknown; order?: unknown } | null;
    if (!v || v.deleted || typeof v.name !== "string") return;
    const t = typeof v.t === "number" ? v.t : 0;
    list.push({ id, name: v.name, t, order: typeof v.order === "number" ? v.order : t });
  });
  return list.sort((a, b) => a.order - b.order || a.t - b.t);
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

/** Modifie une feuille en gardant ses autres informations (nom, date, ordre). */
function patch(doc: Y.Doc, id: string, changes: Record<string, unknown>): void {
  const map = sheetsMap(doc);
  const current = (map.get(id) as Record<string, unknown> | undefined) ?? {};
  map.set(id, { ...current, ...changes });
}

export function addSheet(doc: Y.Doc, name: string): Sheet {
  const t = Date.now();
  // Nouvel onglet à la fin (la date de création sert d'ordre tant qu'on n'a rien déplacé).
  const sheet = { id: crypto.randomUUID().slice(0, 8), name: cleanSheetName(name) || "Nouvelle feuille", t, order: t };
  sheetsMap(doc).set(sheet.id, { name: sheet.name, t: sheet.t });
  return sheet;
}

export function renameSheet(doc: Y.Doc, sheet: Sheet, name: string): void {
  const clean = cleanSheetName(name);
  if (!clean || clean === sheet.name) return;
  patch(doc, sheet.id, sheet.id === MAIN_SHEET ? { name: clean } : { name: clean, t: sheet.t });
}

/** Déplace un onglet : toutes les feuilles reçoivent leur nouvelle place (0, 1, 2…), pour tout le groupe. */
export function moveSheet(doc: Y.Doc, sheets: Sheet[], id: string, toIndex: number): void {
  const from = sheets.findIndex((s) => s.id === id);
  if (from < 0) return;
  const list = [...sheets];
  const [moved] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, moved);
  doc.transact(() => list.forEach((s, order) => patch(doc, s.id, s.id === MAIN_SHEET ? { order } : { name: s.name, t: s.t, order })));
}

/** Retire la feuille de la liste (son texte reste dans le projet). */
export function deleteSheet(doc: Y.Doc, sheet: Sheet): void {
  if (sheet.id === MAIN_SHEET) return;
  patch(doc, sheet.id, { name: sheet.name, t: sheet.t, deleted: Date.now() });
}
