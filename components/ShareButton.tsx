"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

// Partage le lien du projet : menu de partage du téléphone, sinon copie dans le presse-papiers.
export function ShareButton({ slug, name }: { slug: string; name: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/p/${encodeURIComponent(slug)}`;
    const text = `Rejoins le projet "${name}" (mot de passe demandé)`;
    const canShare = typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (canShare) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch {
        // partage annulé : on copie le lien à la place
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copie ce lien :", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={share}
      className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-neutral-800 ring-1 ring-neutral-300 hover:bg-neutral-50"
    >
      {copied ? <Check size={14} className="text-green-600" aria-hidden /> : <Share2 size={14} aria-hidden />}
      {copied ? "Lien copié" : "Partager"}
    </button>
  );
}
