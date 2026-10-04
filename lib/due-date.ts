"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";

// Date de rendu du groupe ("2026-10-15"), partagée dans le document Yjs.

function settings(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("settings");
}

function read(doc: Y.Doc): string | null {
  const value = settings(doc).get("dueDate");
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function useDueDate(doc: Y.Doc): string | null {
  const [value, setValue] = useState<string | null>(() => read(doc));
  useEffect(() => {
    const map = settings(doc);
    const update = () => setValue(read(doc));
    map.observe(update);
    update();
    return () => map.unobserve(update);
  }, [doc]);
  return value;
}

export function setDueDate(doc: Y.Doc, value: string | null): void {
  if (value) settings(doc).set("dueDate", value);
  else settings(doc).delete("dueDate");
}

function toDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "mercredi 15 octobre" */
export function formatDueDate(value: string, short = false): string {
  return toDate(value).toLocaleDateString(
    "fr-FR",
    short ? { day: "numeric", month: "short" } : { weekday: "long", day: "numeric", month: "long" },
  );
}

/** Jours restants (0 = aujourd'hui, négatif = dépassé). */
export function daysLeft(value: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((toDate(value).getTime() - today.getTime()) / 86400000);
}

/** Texte et couleur du compte à rebours : gris, orange à une semaine, rouge à 2 jours. */
export function countdown(value: string): { text: string; tone: string } {
  const days = daysLeft(value);
  if (days < 0) return { text: "Date dépassée", tone: "bg-neutral-200 text-neutral-700" };
  if (days === 0) return { text: "Aujourd'hui", tone: "bg-red-600 text-white" };
  if (days <= 2) return { text: `J-${days}`, tone: "bg-red-600 text-white" };
  if (days <= 7) return { text: `J-${days}`, tone: "bg-amber-400 text-amber-950" };
  return { text: `J-${days}`, tone: "bg-neutral-100 text-neutral-700" };
}

/** Re-rendu toutes les minutes, pour que le compte à rebours change à minuit. */
export function useMinuteTick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
}
