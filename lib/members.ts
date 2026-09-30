"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";
import { isPaletteColor, type Identity } from "@/lib/identity";

// Membres du projet : toute personne ayant choisi un prénom, enregistrée dans le document Yjs.
export type Member = { id: string; name: string; color: string; seen: number };

function membersMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("members");
}

export function readMembers(doc: Y.Doc): Member[] {
  const list: Member[] = [];
  membersMap(doc).forEach((value, id) => {
    const v = value as Partial<Member> | null;
    if (!v || typeof v.name !== "string" || !v.name) return;
    list.push({
      id,
      name: v.name,
      color: isPaletteColor(v.color) ? v.color : "#6b7280",
      seen: typeof v.seen === "number" ? v.seen : 0,
    });
  });
  return list;
}

export function useMembers(doc: Y.Doc): Member[] {
  const [members, setMembers] = useState<Member[]>(() => readMembers(doc));
  useEffect(() => {
    const map = membersMap(doc);
    const update = () => setMembers(readMembers(doc));
    map.observe(update);
    update();
    return () => map.unobserve(update);
  }, [doc]);
  return members;
}

/** Inscrit (ou met à jour) la personne courante dans la liste des membres. */
export function registerMember(doc: Y.Doc, id: string, identity: Identity): void {
  const map = membersMap(doc);
  const current = map.get(id) as Partial<Member> | undefined;
  const now = Date.now();
  // On évite d'écrire à chaque rendu : seulement si le prénom, la couleur ou le jour change.
  const sameDay = current?.seen && new Date(current.seen).toDateString() === new Date(now).toDateString();
  if (current?.name === identity.name && current?.color === identity.color && sameDay) return;
  map.set(id, { name: identity.name, color: identity.color, seen: now });
}

/** Signe de vie : "vu à" mis à jour pendant qu'on est connecté. */
export function touchMember(doc: Y.Doc, id: string, identity: Identity): void {
  membersMap(doc).set(id, { name: identity.name, color: identity.color, seen: Date.now() });
}

export function removeMember(doc: Y.Doc, id: string): void {
  membersMap(doc).delete(id);
}
