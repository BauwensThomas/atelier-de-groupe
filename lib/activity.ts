"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";
import type { Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Identity } from "@/lib/identity";

// Journal d'activité partagé, stocké dans le document Yjs.

export type ActivityType =
  | "join"
  | "leave"
  | "write"
  | "erase"
  | "strike"
  | "restore"
  | "add-question"
  | "add-sujet"
  | "remove-question"
  | "remove-sujet"
  | "unlock"
  | "title"
  | "authors"
  | "version-save"
  | "version-restore"
  | "due-date"
  | "task-add"
  | "task-done"
  | "comment"
  | "image"
  | "sheet-add"
  | "sheet-delete"
  | "file-add"
  | "file-delete"
  | "prof-visit"
  | "prof-note"
  | "prof-reply";

export type Activity = {
  t: number;
  uid: string;
  name: string;
  color: string;
  type: ActivityType;
  detail?: string;
};

const MAX_ENTRIES = 500;
// Activités fréquentes : on prolonge la même ligne tant qu'il n'y a pas 5 minutes de pause,
// en la remettant à jour au plus toutes les 30 secondes.
const SESSION_GAP_MS = 5 * 60 * 1000;
const REFRESH_MS = 30 * 1000;
const THROTTLED: ActivityType[] = ["write", "erase", "strike", "restore", "title", "authors"];

const pending = new Map<string, { at: number }>();

function activityArray(doc: Y.Doc): Y.Array<Activity> {
  return doc.getArray<Activity>("activity");
}

export function useActivity(doc: Y.Doc): Activity[] {
  const [items, setItems] = useState<Activity[]>(() => activityArray(doc).toArray());
  useEffect(() => {
    const arr = activityArray(doc);
    const update = () => setItems(arr.toArray());
    arr.observe(update);
    update();
    return () => arr.unobserve(update);
  }, [doc]);
  return items;
}

export function logActivity(
  doc: Y.Doc,
  uid: string,
  who: Identity,
  type: ActivityType,
  detail?: string,
  at?: number,
  force = false,
): void {
  const arr = activityArray(doc);
  const now = at ?? Date.now();
  let previous: { index: number; item: Activity } | null = null;
  if (THROTTLED.includes(type)) {
    for (let i = arr.length - 1; i >= Math.max(0, arr.length - 60); i--) {
      const a = arr.get(i);
      if (a.uid === uid && a.type === type && a.detail === detail && now - a.t < SESSION_GAP_MS) {
        previous = { index: i, item: a };
        break;
      }
    }
    if (previous && !force && now - previous.item.t < REFRESH_MS) {
      // Trop tôt pour réécrire : on retient l'heure et on met à jour un peu plus tard.
      const key = `${uid}|${type}|${detail ?? ""}`;
      const waiting = pending.get(key);
      if (waiting) {
        waiting.at = now;
      } else {
        const entry = { at: now };
        pending.set(key, entry);
        setTimeout(() => {
          pending.delete(key);
          logActivity(doc, uid, who, type, detail, entry.at, true);
        }, REFRESH_MS - (now - previous.item.t) + 50);
      }
      return;
    }
  }
  const entry: Activity = { t: now, uid, name: who.name, color: who.color, type };
  if (detail) entry.detail = detail;
  doc.transact(() => {
    // La ligne prolongée remonte en haut avec la nouvelle heure.
    if (previous) arr.delete(previous.index, 1);
    arr.push([entry]);
    if (arr.length > MAX_ENTRIES) arr.delete(0, arr.length - MAX_ENTRIES);
  });
}

/** Anciennes lignes devenues inutiles (arrivées, départs, écriture) : on les efface du document. */
const OBSOLETE: ActivityType[] = ["join", "leave", "write"];

export function purgeObsoleteActivity(doc: Y.Doc): void {
  const arr = activityArray(doc);
  const items = arr.toArray();
  if (!items.some((a) => OBSOLETE.includes(a.type))) return;
  doc.transact(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      if (OBSOLETE.includes(items[i].type)) arr.delete(i, 1);
    }
  });
}

function countBlocks(doc: PMNode): { question: number; sujet: number } {
  const count = { question: 0, sujet: 0 };
  doc.descendants((node) => {
    if (node.type.name !== "question") return true;
    if (node.attrs.kind === "sujet") count.sujet++;
    else count.question++;
    return false;
  });
  return count;
}

function firstAuthor(doc: PMNode, from: number, to: number): string | undefined {
  let name: string | undefined;
  doc.nodesBetween(from, to, (node) => {
    if (name) return false;
    const mark = node.isText ? node.marks.find((m) => m.type.name === "author") : undefined;
    if (mark && typeof mark.attrs.name === "string") name = mark.attrs.name;
    return true;
  });
  return name;
}

type StepJSON = {
  stepType: string;
  from?: number;
  to?: number;
  pos?: number;
  attr?: string;
  value?: unknown;
  mark?: { type: string };
  slice?: unknown;
};

/** Traduit une transaction locale en activités lisibles. */
export function describeTransaction(tr: Transaction): Array<{ type: ActivityType; detail?: string }> {
  const out: Array<{ type: ActivityType; detail?: string }> = [];
  const add = (type: ActivityType, detail?: string) => {
    if (!out.some((o) => o.type === type && o.detail === detail)) out.push({ type, detail });
  };

  tr.steps.forEach((step, i) => {
    const json = step.toJSON() as StepJSON;
    const doc = tr.docs[i];
    if (json.stepType === "replace" && typeof json.from === "number" && typeof json.to === "number") {
      const inserted = (step as unknown as { slice: { content: { textBetween: (a: number, b: number) => string; size: number } } }).slice;
      if (inserted.content.size > 0 && inserted.content.textBetween(0, inserted.content.size).trim()) add("write");
      if (json.to > json.from && doc.textBetween(json.from, json.to).trim()) add("erase");
    } else if (json.stepType === "addMark" && json.mark?.type === "deleted") {
      add("strike", firstAuthor(doc, json.from ?? 0, json.to ?? 0));
    } else if (json.stepType === "removeMark" && json.mark?.type === "deleted") {
      add("restore");
    } else if (json.stepType === "attr" && json.attr === "locked" && json.value === false) {
      const node = typeof json.pos === "number" ? doc.nodeAt(json.pos) : null;
      add("unlock", node?.attrs.kind === "sujet" ? "sujet" : "question");
    }
  });

  if (tr.docChanged) {
    const before = countBlocks(tr.before);
    const after = countBlocks(tr.doc);
    if (after.question > before.question) add("add-question");
    if (after.question < before.question) add("remove-question");
    if (after.sujet > before.sujet) add("add-sujet");
    if (after.sujet < before.sujet) add("remove-sujet");
  }
  // Un bloc supprimé suffit à décrire l'action, pas besoin de "a supprimé du texte" en plus.
  if (out.some((o) => o.type === "remove-question" || o.type === "remove-sujet")) {
    return out.filter((o) => o.type !== "erase");
  }
  return out;
}

export function describeActivity(a: Activity): string {
  switch (a.type) {
    case "join":
      return "a rejoint le document";
    case "leave":
      return "a quitté le document";
    case "write":
      return "a écrit";
    case "erase":
      return "a supprimé du texte";
    case "strike":
      if (!a.detail) return "a barré du texte";
      // "d'Alice", "de Thomas"
      return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(a.detail)
        ? `a barré du texte d'${a.detail}`
        : `a barré du texte de ${a.detail}`;
    case "restore":
      return "a restauré du texte barré";
    case "add-question":
      return "a ajouté une question";
    case "add-sujet":
      return "a ajouté un sujet";
    case "remove-question":
      return "a supprimé une question";
    case "remove-sujet":
      return "a supprimé un sujet";
    case "unlock":
      return a.detail === "sujet" ? "a déverrouillé un sujet" : "a déverrouillé une question";
    case "title":
      return "a modifié le titre";
    case "authors":
      return "a modifié les auteurs";
    case "version-save":
      return "a enregistré une version";
    case "version-restore":
      return a.detail ? `a restauré la version de ${a.detail}` : "a restauré une version";
    case "prof-visit":
      return `a consulté le projet en tant que professeur (${a.detail ?? ""})`;
    case "prof-note":
      return "a laissé une note (professeur)";
    case "prof-reply":
      return "a répondu à un commentaire (professeur)";
    case "file-add":
      return `a ajouté le fichier « ${a.detail ?? ""} »`;
    case "file-delete":
      return `a supprimé le fichier « ${a.detail ?? ""} »`;
    case "sheet-add":
      return `a créé la feuille « ${a.detail ?? ""} »`;
    case "sheet-delete":
      return `a supprimé la feuille « ${a.detail ?? ""} »`;
    case "image":
      return "a ajouté une image";
    case "comment":
      return "a ajouté un commentaire";
    case "task-add":
      return `a ajouté la tâche « ${a.detail ?? ""} »`;
    case "task-done":
      return `a fini la tâche « ${a.detail ?? ""} »`;
    case "due-date":
      return a.detail ? `a fixé la date de rendu au ${a.detail}` : "a retiré la date de rendu";
  }
}
