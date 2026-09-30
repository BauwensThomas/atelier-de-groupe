"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";
import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Identity } from "@/lib/identity";
import { internalKey } from "@/lib/editor/shared";

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
};

const MAX_VERSIONS = 30;
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

export function lastVersion(doc: Y.Doc): Version | null {
  const arr = versionsArray(doc);
  return arr.length ? arr.get(arr.length - 1) : null;
}

/** Enregistre une copie. Renvoie false si rien n'a changé depuis la dernière copie. */
export function saveVersion(
  doc: Y.Doc,
  content: PMNode,
  who: Identity,
  reason: VersionReason,
): boolean {
  const json = JSON.stringify(content.toJSON());
  const title = doc.getText("title").toString();
  const authors = doc.getText("authors").toString();
  const previous = lastVersion(doc);
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
  };
  const arr = versionsArray(doc);
  doc.transact(() => {
    arr.push([version]);
    if (arr.length > MAX_VERSIONS) arr.delete(0, arr.length - MAX_VERSIONS);
  });
  return true;
}

function replaceText(ytext: Y.Text, value: string) {
  if (ytext.toString() === value) return;
  ytext.delete(0, ytext.length);
  ytext.insert(0, value);
}

/** Remet le document dans l'état d'une version (la version actuelle est enregistrée avant). */
export function restoreVersion(doc: Y.Doc, editor: Editor, version: Version, who: Identity): void {
  saveVersion(doc, editor.state.doc, who, "before-restore");
  const content = editor.schema.nodeFromJSON(JSON.parse(version.json) as JSONContent);
  const { state, view } = editor;
  // Meta interne : pas de rature, pas de verrou, pas de recoloration pendant la restauration.
  view.dispatch(state.tr.replaceWith(0, state.doc.content.size, content.content).setMeta(internalKey, true).setMeta(RESTORE_META, true));
  doc.transact(() => {
    replaceText(doc.getText("title"), version.title);
    replaceText(doc.getText("authors"), version.authors);
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
