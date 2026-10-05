"use client";

import { useEffect, useMemo, useState } from "react";
import type * as Y from "yjs";
import type { Activity } from "@/lib/activity";
import type { Thread } from "@/lib/comments";

// Suivi du professeur, pour les élèves : ses visites (avec leur durée) et ses notes.
// Le professeur ne peut pas écrire dans le document : ses visites sont gardées dans le salon des notes.

type Visit = { name: string; color: string; start: number; end: number };

const TICK_MS = 60 * 1000;

function visitsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("visits");
}

/** Le professeur enregistre sa visite à l'arrivée, puis l'heure de sa dernière présence chaque minute. */
export function useRecordVisit(doc: Y.Doc | null, enabled: boolean, name: string | undefined, color: string | undefined) {
  useEffect(() => {
    if (!doc || !enabled || !name || !color) return;
    const id = crypto.randomUUID();
    const start = Date.now();
    const save = () => visitsMap(doc).set(id, { name, color, start, end: Date.now() } satisfies Visit);
    save();
    const timer = setInterval(save, TICK_MS);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [doc, enabled, name, color]);
}

function duration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "moins d'une minute";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** Lignes d'activité du professeur (visites et notes), à mêler à l'activité du groupe. */
export function useProfActivity(doc: Y.Doc | null, threads: Thread[]): Activity[] {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!doc) return;
    const map = visitsMap(doc);
    const update = () => {
      const list: Visit[] = [];
      map.forEach((v) => {
        const x = v as Partial<Visit> | null;
        if (x && typeof x.name === "string" && typeof x.start === "number" && typeof x.end === "number") {
          list.push({ name: x.name, color: typeof x.color === "string" ? x.color : "#c026d3", start: x.start, end: x.end });
        }
      });
      setVisits(list);
    };
    map.observe(update);
    update();
    return () => map.unobserve(update);
  }, [doc]);

  return useMemo(() => {
    const out: Activity[] = visits.map((v) => ({
      t: v.start,
      uid: "prof",
      name: v.name,
      color: v.color,
      type: "prof-visit",
      // Visite en cours (dernière présence il y a moins de 2 minutes) : on le dit.
      detail: now - v.end < 2 * TICK_MS ? `en cours, ${duration(v.end - v.start)}` : duration(v.end - v.start),
    }));
    for (const t of threads) {
      for (const m of [t, ...t.replies]) {
        if (m.prof) out.push({ t: m.t, uid: "prof", name: m.name, color: m.color, type: m === t ? "prof-note" : "prof-reply" });
      }
    }
    return out;
  }, [visits, threads, now]);
}
