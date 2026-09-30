"use client";

import { useMemo, useState } from "react";
import { describeActivity, type Activity } from "@/lib/activity";

const VISIBLE = 5;
// Arrivées, départs et écriture ne sont plus affichés : la liste des membres les montre en direct.
const HIDDEN: Activity["type"][] = ["join", "leave", "write"];

function dayLabel(time: number): string {
  const date = new Date(time);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function hour(time: number): string {
  return new Date(time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function ActivityList({ items }: { items: Activity[] }) {
  const [expanded, setExpanded] = useState(false);

  // Plus récent en haut ; à heure égale, la dernière ligne ajoutée d'abord.
  const sorted = useMemo(
    () =>
      items
        .map((a, i) => ({ ...a, i, key: `${a.t}-${a.uid}-${i}` }))
        .filter((a) => !HIDDEN.includes(a.type))
        .sort((x, y) => y.t - x.t || y.i - x.i),
    [items],
  );

  const shown = expanded ? sorted : sorted.slice(0, VISIBLE);
  const groups: Array<{ day: string; entries: typeof sorted }> = [];
  for (const a of shown) {
    const day = dayLabel(a.t);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(a);
    else groups.push({ day, entries: [a] });
  }

  return (
    <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-neutral-200">
      <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Activité</h2>
      {sorted.length === 0 ? (
        <p className="text-xs text-neutral-400">Rien pour le moment.</p>
      ) : (
        <>
          <div className={expanded ? "-mr-2 max-h-72 overflow-y-auto pr-2" : ""}>
            {groups.map((g) => (
              <div key={g.day} className="mb-2 last:mb-0">
                <p className="sticky top-0 bg-white py-0.5 text-[11px] font-medium text-neutral-400 first-letter:uppercase">
                  {g.day}
                </p>
                <ul className="flex flex-col gap-1">
                  {g.entries.map((a) => (
                    <li key={a.key} className="flex items-start gap-1.5 text-xs leading-snug">
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: a.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{a.name}</span>{" "}
                        <span className="text-neutral-600">{describeActivity(a)}</span>
                      </span>
                      <time className="shrink-0 text-[11px] text-neutral-400" dateTime={new Date(a.t).toISOString()}>
                        {hour(a.t)}
                      </time>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {sorted.length > VISIBLE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
            >
              {expanded ? "Réduire" : `Voir tout (${sorted.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
