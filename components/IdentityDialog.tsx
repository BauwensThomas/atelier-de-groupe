"use client";

import { useState, type FormEvent } from "react";
import { Ban, Check } from "lucide-react";
import { NAME_MAX, PALETTE, cleanName, type Identity } from "@/lib/identity";

type Props = {
  initial: Identity | null;
  /** Les autres personnes du groupe : leurs couleurs sont prises, leurs prénoms déjà utilisés. */
  others: Array<{ name: string; color: string }>;
  onSave: (identity: Identity) => void;
  onCancel?: () => void;
  /** Professeur : couleur imposée (réservée), pas de choix. */
  fixedColor?: string;
  /** Pas encore de prénom : fond opaque, rien du projet n'est visible derrière. */
  cover?: boolean;
};

/** Sans majuscules, accents ni espaces en trop : "Élise " et "elise" sont le même prénom. */
function fold(name: string): string {
  return cleanName(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function IdentityDialog({ initial, others, onSave, onCancel, fixedColor, cover = false }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(fixedColor ?? initial?.color ?? "");
  const [itsMe, setItsMe] = useState(false);

  // Prénom déjà utilisé par un autre membre (sauf si c'est déjà le sien) : il faut confirmer que c'est bien soi.
  const typed = fold(name);
  const nameUsed = !fixedColor && typed !== "" && typed !== fold(initial?.name ?? "") && others.some((o) => fold(o.name) === typed);
  // Couleurs prises : celles des autres prénoms (les siennes, même prénom, restent libres).
  const takenColors = new Set(others.filter((o) => fold(o.name) !== typed).map((o) => o.color));
  const colorTaken = !fixedColor && color !== "" && takenColors.has(color) && color !== initial?.color;
  const canSave = cleanName(name) !== "" && color !== "" && !colorTaken && (!nameUsed || itsMe);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    onSave({ name: cleanName(name), color });
  }

  return (
    <div className={`no-print fixed inset-0 z-50 flex items-center justify-center px-4 ${cover ? "bg-neutral-100" : "bg-black/30"}`}>
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
          onChange={(e) => {
            setName(e.target.value);
            setItsMe(false);
          }}
          aria-invalid={nameUsed && !itsMe}
          aria-describedby={nameUsed ? "identity-name-used" : undefined}
          className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 ${
            nameUsed && !itsMe ? "border-red-500 focus:ring-red-500/20" : "border-neutral-300 focus:border-neutral-900 focus:ring-neutral-900/10"
          }`}
        />
        {nameUsed && (
          <div id="identity-name-used" className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-800 ring-1 ring-red-200">
            <p>Ce prénom est déjà utilisé dans le groupe. Ajoute l&apos;initiale de ton nom (ex : {cleanName(name)} B.).</p>
            <label className="mt-2 flex items-center gap-2 font-medium">
              <input type="checkbox" checked={itsMe} onChange={(e) => setItsMe(e.target.checked)} className="h-4 w-4 accent-red-700" />
              C&apos;est bien moi, sur un autre appareil
            </label>
          </div>
        )}

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
                  } ${taken ? "cursor-not-allowed" : "hover:scale-105"}`}
                  style={{ backgroundColor: taken ? "#d4d4d4" : c.value }}
                >
                  {selected && <Check size={18} className="text-white" aria-hidden />}
                  {taken && !selected && <Ban size={22} strokeWidth={2.5} className="text-red-600" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-neutral-500">Les couleurs barrées d&apos;un interdit sont déjà prises par un membre du groupe.</p>
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
