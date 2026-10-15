"use client";

import { Check, Save, WifiOff } from "lucide-react";

// Bouton Enregistrer : rouge s'il y a des modifications pas encore enregistrées dans les versions,
// orange pendant l'envoi, vert quand tout est enregistré. Ctrl+S fait la même chose.

export type SaveState = "saved" | "unsaved" | "sending" | "offline";

const LOOK: Record<SaveState, { text: string; hint: string; className: string }> = {
  unsaved: {
    text: "Enregistrer",
    hint: "Des modifications ne sont pas encore dans les versions. Clique (ou Ctrl+S) pour enregistrer.",
    className: "bg-red-600 text-white hover:bg-red-700",
  },
  sending: {
    text: "Envoi…",
    hint: "Les modifications sont en cours d'envoi.",
    className: "bg-amber-500 text-white hover:bg-amber-600",
  },
  saved: {
    text: "Enregistré",
    hint: "Tout est enregistré, versions à jour.",
    className: "bg-green-600 text-white hover:bg-green-700",
  },
  offline: {
    text: "Hors ligne",
    hint: "Pas de connexion : les modifications seront envoyées au retour de la connexion. Ne ferme pas la page.",
    className: "bg-red-700 text-white hover:bg-red-800",
  },
};

export function SaveButton({ state, onSave, compact = false }: { state: SaveState; onSave: () => void; compact?: boolean }) {
  const look = LOOK[state];
  const Icon = state === "saved" ? Check : state === "offline" ? WifiOff : Save;
  const label = `${look.text} (Ctrl+S)`;
  if (compact) {
    return (
      <button
        type="button"
        onClick={onSave}
        title={`${look.text} : ${look.hint}`}
        aria-label={label}
        className={`flex h-9 w-9 items-center justify-center rounded-md ${look.className}`}
      >
        {/* Panneau replié : toujours la disquette, la couleur dit si c'est enregistré. */}
        <Save size={17} aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onSave}
      title={look.hint}
      aria-label={label}
      className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold shadow-sm transition-colors ${look.className}`}
    >
      <Icon size={17} aria-hidden />
      {look.text}
      <span className="text-xs font-normal opacity-80">Ctrl+S</span>
    </button>
  );
}
