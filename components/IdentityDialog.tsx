"use client";

import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { NAME_MAX, PALETTE, cleanName, type Identity } from "@/lib/identity";

type Props = {
  initial: Identity | null;
  takenColors: Set<string>;
  onSave: (identity: Identity) => void;
  onCancel?: () => void;
  /** Professeur : couleur imposée (réservée), pas de choix. */
  fixedColor?: string;
};

export function IdentityDialog({ initial, takenColors, onSave, onCancel, fixedColor }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(fixedColor ?? initial?.color ?? "");

  const colorTaken = !fixedColor && color !== "" && takenColors.has(color) && color !== initial?.color;
  const canSave = cleanName(name) !== "" && color !== "" && !colorTaken;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    onSave({ name: cleanName(name), color });
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-title"
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
      >
        <h2 id="identity-title" className="text-lg font-semibold">
          Qui es-tu ?
        </h2>
        <p className="mb-4 text-sm text-neutral-500">
          {fixedColor ? "Ton prénom apparaît sur tes notes." : "Ton texte sera écrit dans ta couleur."}
        </p>

        <label htmlFor="identity-name" className="mb-1 block text-sm font-medium">
          Prénom
        </label>
        <input
          id="identity-name"
          autoFocus
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />

        {fixedColor ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-neutral-700">
            <span className="h-5 w-5 shrink-0 rounded-full" style={{ backgroundColor: fixedColor }} aria-hidden />
            Ta couleur est réservée au professeur : les élèves ne peuvent pas la prendre.
          </p>
        ) : (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium">Couleur</legend>
          <div className="grid grid-cols-4 gap-2">
            {PALETTE.map((c) => {
              const taken = takenColors.has(c.value) && c.value !== initial?.color;
              const selected = color === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  disabled={taken}
                  onClick={() => setColor(c.value)}
                  aria-pressed={selected}
                  aria-label={taken ? `${c.label} (déjà prise)` : c.label}
                  title={taken ? `${c.label} : déjà prise` : c.label}
                  className={`flex h-11 items-center justify-center rounded-lg ring-offset-2 transition ${
                    selected ? "ring-2 ring-neutral-900" : ""
                  } ${taken ? "cursor-not-allowed opacity-25 grayscale" : "hover:scale-105"}`}
                  style={{ backgroundColor: c.value }}
                >
                  {selected && <Check size={18} className="text-white" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-neutral-500">Les couleurs grisées sont prises par une personne connectée.</p>
        </fieldset>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Valider
          </button>
        </div>
      </form>
    </div>
  );
}
