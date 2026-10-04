"use client";

import { useEffect, useState } from "react";
import { Check, Copy, GraduationCap, RefreshCw, X } from "lucide-react";
import { useConfirm } from "./ConfirmDialog";

// Lien professeur : lecture seule et notes, sans le mot de passe du groupe.
function TeacherLinkDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const confirm = useConfirm();
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function load(renew: boolean) {
    setError("");
    const res = await fetch("/api/projects/teacher-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, renew }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { key?: string; error?: string }) : {};
    if (res?.ok && data.key) setLink(`${window.location.origin}/prof/${encodeURIComponent(slug)}#${data.key}`);
    else setError(data.error ?? "Connexion impossible. Réessaie.");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie ce lien :", link);
    }
  }

  async function renew() {
    const ok = await confirm({
      title: "Créer un nouveau lien ?",
      message: "L'ancien lien ne marchera plus, même pour un professeur déjà connecté.",
      confirmLabel: "Nouveau lien",
      danger: true,
    });
    if (ok) await load(true);
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="teacher-title" className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2.5">
          <h2 id="teacher-title" className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap size={16} aria-hidden />
            Lien professeur
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1 hover:bg-neutral-100">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4 text-sm">
          <p className="text-neutral-700">
            Avec ce lien, le professeur <strong>lit le document</strong> et y laisse des <strong>notes</strong>, sans pouvoir le
            modifier. Pas besoin du mot de passe.
          </p>
          {error ? (
            <p className="text-red-700">{error}</p>
          ) : (
            <div className="flex gap-1.5">
              <input
                readOnly
                value={link || "Chargement…"}
                onFocus={(e) => e.target.select()}
                aria-label="Lien professeur"
                className="h-8 min-w-0 flex-1 rounded-md bg-neutral-50 px-2 text-xs ring-1 ring-neutral-300"
              />
              <button
                type="button"
                onClick={copy}
                disabled={!link}
                className="flex shrink-0 items-center gap-1 rounded-md bg-neutral-900 px-2.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
              >
                {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                {copied ? "Copié" : "Copier"}
              </button>
            </div>
          )}
          <p className="text-xs text-neutral-500">Ne le partage qu&apos;avec ton professeur.</p>
          <button
            type="button"
            onClick={renew}
            className="flex items-center gap-1.5 self-start text-xs font-medium text-neutral-600 hover:text-neutral-900"
          >
            <RefreshCw size={13} aria-hidden />
            Nouveau lien (l&apos;ancien ne marchera plus)
          </button>
        </div>
      </div>
    </div>
  );
}

export function TeacherLinkButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-neutral-800 ring-1 ring-neutral-300 hover:bg-neutral-50"
      >
        <GraduationCap size={14} aria-hidden />
        Lien professeur
      </button>
      {open && <TeacherLinkDialog slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}
