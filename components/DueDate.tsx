"use client";

import { useState } from "react";
import { CalendarDays, Pencil } from "lucide-react";
import { countdown, formatDueDate, useMinuteTick } from "@/lib/due-date";

// Date de rendu dans la carte "Projet" : affichage, compte à rebours, modification par tout le groupe.
export function DueDate({ value, editable, onChange }: { value: string | null; editable: boolean; onChange: (value: string | null) => void }) {
  useMinuteTick();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    return (
      <form
        className="mb-2 flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft !== (value ?? "")) onChange(draft || null);
          setEditing(false);
        }}
      >
        <label className="text-[11px] text-neutral-500" htmlFor="due-date">
          Date de rendu
        </label>
        <input
          id="due-date"
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          className="h-8 rounded-md px-2 text-sm ring-1 ring-neutral-300 outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <div className="flex gap-1.5">
          <button type="submit" className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800">
            OK
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-md px-2.5 py-1 text-xs text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50">
            Annuler
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setEditing(false);
              }}
              className="ml-auto rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Retirer
            </button>
          )}
        </div>
      </form>
    );
  }

  const start = () => {
    setDraft(value ?? "");
    setEditing(true);
  };

  if (!value) {
    return editable ? (
      <button type="button" onClick={start} className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800">
        <CalendarDays size={13} aria-hidden />
        Ajouter la date de rendu
      </button>
    ) : null;
  }

  const left = countdown(value);
  return (
    <div className="mb-2 flex items-center gap-2">
      <CalendarDays size={14} className="shrink-0 text-neutral-500" aria-hidden />
      <span className="min-w-0 truncate text-xs text-neutral-700">Rendu le {formatDueDate(value)}</span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${left.tone}`}>{left.text}</span>
      {editable && (
        <button
          type="button"
          onClick={start}
          title="Modifier la date de rendu"
          aria-label="Modifier la date de rendu"
          className="ml-auto shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <Pencil size={12} aria-hidden />
        </button>
      )}
    </div>
  );
}
