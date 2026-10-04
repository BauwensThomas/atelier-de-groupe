"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";
import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from "@tiptap/y-tiptap";
import type { Identity } from "@/lib/identity";
import { internalKey } from "@/lib/editor/shared";
import { MAIN_SHEET, sheetField } from "@/lib/sheets";

// Copies du document, stockées à part dans le document Yjs (effacer le texte ne les touche pas).

export type VersionReason = "auto" | "manual" | "before-delete" | "before-restore";

export type Version = {
  id: string;
  t: number;
  by: string;
  color: string;
  reason: VersionReason;
  words: number;
  title: string;
  authors: string;
  json: string;
  /** Feuille copiée (absent : feuille principale, pour les anciennes versions). */
  sheet?: string;
  /** Copies faites au même moment (un seul enregistrement pour plusieurs feuilles). */
  batch?: string;
};

/** Un enregistrement : une ou plusieurs feuilles copiées ensemble. */
export type VersionGroup = { key: string; t: number; by: string; color: string; reason: VersionReason; versions: Version[] };

export function newBatch(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Regroupe les copies faites ensemble (les plus récentes d'abord). */
export function groupVersions(versions: Version[]): VersionGroup[] {
  const groups = new Map<string, VersionGroup>();
  for (const v of [...versions].sort((a, b) => b.t - a.t)) {
    // Anciennes copies sans identifiant commun : même personne, même raison, à 5 secondes près.
    const key = v.batch ?? `${v.reason}|${v.by}|${Math.floor(v.t / 5000)}`;
    const group = groups.get(key);
    if (group) group.versions.push(v);
    else groups.set(key, { key, t: v.t, by: v.by, color: v.color, reason: v.reason, versions: [v] });
  }
  return [...groups.values()];
}

const MAX_VERSIONS = 30;
/** Nombre total gardé, toutes feuilles confondues. */
const MAX_TOTAL = 90;
/** Meta posée sur la transaction de restauration (ignorée par le journal d'activité). */
export const RESTORE_META = "gp-restore";
export const AUTO_INTERVAL_MS = 10 * 60 * 1000;

function versionsArray(doc: Y.Doc): Y.Array<Version> {
  return doc.getArray<Version>("versions");
}

export function useVersions(doc: Y.Doc): Version[] {
  const [items, setItems] = useState<Version[]>(() => versionsArray(doc).toArray());
  useEffect(() => {
    const arr = versionsArray(doc);
    const update = () => setItems(arr.toArray());
    arr.observe(update);
    update();
    return () => arr.unobserve(update);
  }, [doc]);
  return items;
}

export function countWords(node: PMNode): number {
  const text = node.textBetween(0, node.content.size, " ", " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

export function versionSheet(v: Version): string {
  return v.sheet ?? MAIN_SHEET;
}

export function lastVersion(doc: Y.Doc, sheet: string = MAIN_SHEET): Version | null {
  const list = versionsArray(doc).toArray().filter((v) => versionSheet(v) === sheet);
  return list.length ? list[list.length - 1] : null;
}

/** Enregistre une copie. Renvoie false si rien n'a changé depuis la dernière copie. */
export function saveVersion(
  doc: Y.Doc,
  content: PMNode,
  who: Identity,
  reason: VersionReason,
  sheet: string = MAIN_SHEET,
  batch?: string,
): boolean {
  const json = JSON.stringify(content.toJSON());
  // Titre et auteurs : seulement pour la feuille principale.
  const main = sheet === MAIN_SHEET;
  const title = main ? doc.getText("title").toString() : "";
  const authors = main ? doc.getText("authors").toString() : "";
  const previous = lastVersion(doc, sheet);
  if (previous && previous.json === json && previous.title === title && previous.authors === authors) {
    return false;
  }
  const version: Version = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    t: Date.now(),
    by: who.name,
    color: who.color,
    reason,
    words: countWords(content),
    title,
    authors,
    json,
    ...(main ? {} : { sheet }),
    ...(batch ? { batch } : {}),
  };
  const arr = versionsArray(doc);
  doc.transact(() => {
    arr.push([version]);
    // Au plus 30 copies par feuille, et 90 en tout : on retire les plus anciennes.
    const sameSheet = arr.toArray().map((v, i) => (versionSheet(v) === sheet ? i : -1)).filter((i) => i >= 0);
    if (sameSheet.length > MAX_VERSIONS) arr.delete(sameSheet[0], 1);
    if (arr.length > MAX_TOTAL) arr.delete(0, arr.length - MAX_TOTAL);
  });
  return true;
}

function replaceText(ytext: Y.Text, value: string) {
  if (ytext.toString() === value) return;
  ytext.delete(0, ytext.length);
  ytext.insert(0, value);
}

/** Remet le document dans l'état d'une version (la version actuelle est enregistrée avant). */
export function restoreVersion(doc: Y.Doc, editor: Editor, version: Version, who: Identity, batch?: string): void {
  const sheet = versionSheet(version);
  saveVersion(doc, editor.state.doc, who, "before-restore", sheet, batch);
  const content = editor.schema.nodeFromJSON(JSON.parse(version.json) as JSONContent);
  const { state, view } = editor;
  // Meta interne : pas de rature, pas de verrou, pas de recoloration pendant la restauration.
  view.dispatch(state.tr.replaceWith(0, state.doc.content.size, content.content).setMeta(internalKey, true).setMeta(RESTORE_META, true));
  if (sheet !== MAIN_SHEET) return;
  doc.transact(() => {
    replaceText(doc.getText("title"), version.title);
    replaceText(doc.getText("authors"), version.authors);
  });
}

/** Restaure une feuille qui n'est pas affichée, directement dans le document partagé. */
export function restoreSheetVersion(doc: Y.Doc, schema: Schema, version: Version, who: Identity, batch?: string): void {
  const sheet = versionSheet(version);
  const fragment = doc.getXmlFragment(sheetField(sheet));
  try {
    saveVersion(doc, schema.nodeFromJSON(yXmlFragmentToProsemirrorJSON(fragment)), who, "before-restore", sheet, batch);
  } catch {
    // feuille illisible : on restaure quand même
  }
  doc.transact(() => {
    fragment.delete(0, fragment.length);
    prosemirrorJSONToYXmlFragment(schema, JSON.parse(version.json), fragment);
    if (sheet === MAIN_SHEET) {
      replaceText(doc.getText("title"), version.title);
      replaceText(doc.getText("authors"), version.authors);
    }
  });
}

/** Vrai si la transaction efface une grosse partie du texte (plus de 300 caractères ou 30 %). */
export function isBigDeletion(before: PMNode, after: PMNode): boolean {
  const a = before.textContent.length;
  const b = after.textContent.length;
  const removed = a - b;
  return removed > 300 || (a > 40 && removed > a * 0.3);
}

export function describeReason(reason: VersionReason): string {
  switch (reason) {
    case "auto":
      return "Copie automatique";
    case "manual":
      return "Enregistrée à la main";
    case "before-delete":
      return "Avant une grosse suppression";
    case "before-restore":
      return "Avant une restauration";
  }
}
