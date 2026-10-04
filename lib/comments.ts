"use client";

import { useEffect, useState } from "react";
import * as Y from "yjs";
import type { EditorState } from "@tiptap/pm/state";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { absolutePositionToRelativePosition, relativePositionToAbsolutePosition } from "@tiptap/y-tiptap";

// Commentaires sur un passage du document. Ils sont rangés dans un salon à part (`<projet>--notes`),
// pour que le professeur puisse commenter sans pouvoir modifier le document lui-même.
// Le passage est repéré par des positions Yjs relatives : elles suivent le texte quand on écrit autour.

export const COMMENT_MAX = 1000;

export type Author = { uid: string; name: string; color: string; prof: boolean };
/** mentions : prénoms cités avec @ dans le message. */
export type Message = Author & { id: string; text: string; t: number; mentions: string[] };
export type Thread = Message & {
  from: unknown;
  to: unknown;
  quote: string;
  resolved: { name: string; t: number } | null;
  replies: Message[];
  /** Feuille du passage commenté. */
  sheet: string;
};

export function notesRoomId(slug: string): string {
  return `${slug}--notes`;
}

function threadsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("threads");
}

function repliesArray(doc: Y.Doc): Y.Array<unknown> {
  return doc.getArray("replies");
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toMessage(id: string, v: Record<string, unknown>): Message {
  return {
    id,
    uid: str(v.uid),
    name: str(v.name) || "Sans prénom",
    color: str(v.color) || "#6b7280",
    prof: v.prof === true,
    text: str(v.text),
    t: typeof v.t === "number" ? v.t : 0,
    mentions: Array.isArray(v.mentions) ? v.mentions.filter((m): m is string => typeof m === "string").slice(0, 20) : [],
  };
}

export function readThreads(doc: Y.Doc): Thread[] {
  const replies = new Map<string, Message[]>();
  for (const raw of repliesArray(doc).toArray()) {
    const v = raw as Record<string, unknown> | null;
    if (!v || typeof v.thread !== "string" || !v.text) continue;
    const list = replies.get(v.thread) ?? [];
    list.push(toMessage(str(v.id), v));
    replies.set(v.thread, list);
  }
  const out: Thread[] = [];
  threadsMap(doc).forEach((raw, id) => {
    const v = raw as Record<string, unknown> | null;
    if (!v || !v.text) return;
    const resolved = v.resolved as { name?: unknown; t?: unknown } | null | undefined;
    out.push({
      ...toMessage(id, v),
      from: v.from,
      to: v.to,
      quote: str(v.quote),
      resolved: resolved && typeof resolved.t === "number" ? { name: str(resolved.name), t: resolved.t } : null,
      replies: (replies.get(id) ?? []).sort((a, b) => a.t - b.t),
      sheet: str(v.sheet) || "main",
    });
  });
  return out.sort((a, b) => a.t - b.t);
}

export function useThreads(doc: Y.Doc | null): Thread[] {
  const [threads, setThreads] = useState<Thread[]>([]);
  useEffect(() => {
    if (!doc) return;
    const update = () => setThreads(readThreads(doc));
    const map = threadsMap(doc);
    const arr = repliesArray(doc);
    map.observe(update);
    arr.observe(update);
    update();
    return () => {
      map.unobserve(update);
      arr.unobserve(update);
    };
  }, [doc]);
  return threads;
}

function binding(state: EditorState) {
  const sync = ySyncPluginKey.getState(state) as
    | { doc: Y.Doc; type: Y.XmlFragment; binding: { mapping: Map<Y.AbstractType<unknown>, unknown> } }
    | undefined;
  return sync?.binding ? sync : null;
}

/** Positions Yjs (enregistrables) du passage sélectionné. */
export function anchorSelection(state: EditorState): { from: unknown; to: unknown; quote: string } | null {
  const sync = binding(state);
  const { from, to } = state.selection;
  if (!sync || from === to) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapping = sync.binding.mapping as any;
  const relFrom = absolutePositionToRelativePosition(from, sync.type, mapping);
  const relTo = absolutePositionToRelativePosition(to, sync.type, mapping);
  return {
    from: Y.relativePositionToJSON(relFrom),
    to: Y.relativePositionToJSON(relTo),
    quote: state.doc.textBetween(from, to, " ").replace(/\s+/g, " ").trim().slice(0, 300),
  };
}

/** Position actuelle du passage commenté dans le document, ou null s'il a disparu. */
export function resolveAnchor(state: EditorState, thread: Pick<Thread, "from" | "to">): { from: number; to: number } | null {
  const sync = binding(state);
  if (!sync || !thread.from || !thread.to) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapping = sync.binding.mapping as any;
    const from = relativePositionToAbsolutePosition(sync.doc, sync.type, Y.createRelativePositionFromJSON(thread.from), mapping);
    const to = relativePositionToAbsolutePosition(sync.doc, sync.type, Y.createRelativePositionFromJSON(thread.to), mapping);
    if (from === null || to === null || to <= from || to > state.doc.content.size) return null;
    return { from, to };
  } catch {
    return null;
  }
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Prénoms cités avec @ dans le texte (parmi les prénoms connus). */
export function findMentions(text: string, names: string[]): string[] {
  const folded = fold(text);
  // "@Max" ne doit pas être trouvé dans "@Maxime" : le prénom doit s'arrêter là.
  return names.filter((n) => {
    const needle = "@" + fold(n);
    for (let i = folded.indexOf(needle); n && i !== -1; i = folded.indexOf(needle, i + 1)) {
      if (!/[a-z0-9]/.test(folded[i + needle.length] ?? "")) return true;
    }
    return false;
  });
}

/** Vrai si ce prénom est cité dans le message. */
export function mentions(message: Message, name: string): boolean {
  return message.mentions.some((m) => fold(m) === fold(name));
}

function clean(text: string): string {
  return text.trim().slice(0, COMMENT_MAX);
}

export function addThread(
  doc: Y.Doc,
  author: Author,
  anchor: { from: unknown; to: unknown; quote: string; sheet: string },
  text: string,
  names: string[] = [],
): string | null {
  const body = clean(text);
  if (!body) return null;
  const id = crypto.randomUUID();
  threadsMap(doc).set(id, { ...author, ...anchor, text: body, t: Date.now(), resolved: null, mentions: findMentions(body, names) });
  return id;
}

export function addReply(doc: Y.Doc, author: Author, thread: string, text: string, names: string[] = []): void {
  const body = clean(text);
  if (!body) return;
  repliesArray(doc).push([{ ...author, id: crypto.randomUUID(), thread, text: body, t: Date.now(), mentions: findMentions(body, names) }]);
}

export function setResolved(doc: Y.Doc, thread: Thread, by: string | null): void {
  const current = threadsMap(doc).get(thread.id) as Record<string, unknown> | undefined;
  if (!current) return;
  threadsMap(doc).set(thread.id, { ...current, resolved: by ? { name: by, t: Date.now() } : null });
}

export function deleteThread(doc: Y.Doc, id: string): void {
  doc.transact(() => {
    threadsMap(doc).delete(id);
    const arr = repliesArray(doc);
    const items = arr.toArray() as Array<{ thread?: string } | null>;
    for (let i = items.length - 1; i >= 0; i--) if (items[i]?.thread === id) arr.delete(i, 1);
  });
}
