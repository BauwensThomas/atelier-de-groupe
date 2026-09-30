"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useConfirm } from "./ConfirmDialog";

type Handover = { name: string; password: string | null; email: string; loginUrl: string };

export function DecisionButtons({ token }: { token: string }) {
  const [loading, setLoading] = useState<"accept" | "refuse" | null>(null);
  const [result, setResult] = useState<"accept" | "refuse" | null>(null);
  const [mailed, setMailed] = useState(false);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [error, setError] = useState("");
  const confirm = useConfirm();

  async function decide(action: "accept" | "refuse") {
    if (
      action === "refuse" &&
      !(await confirm({
        title: "Refuser cette demande ?",
        message: "Le projet est supprimé et son nom redevient libre.",
        confirmLabel: "Refuser",
        danger: true,
      }))
    )
      return;
    setLoading(action);
    setError("");
    try {
      const res = await fetch("/api/projects/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; mailed?: boolean; handover?: Handover };
      if (res.ok) {
        setMailed(Boolean(data.mailed));
        setHandover(data.handover ?? null);
        setResult(action);
      }
      else setError(data.error ?? "Action impossible.");
    } catch {
      setError("Action impossible. Vérifie ta connexion internet.");
    }
    setLoading(null);
  }

  if (result === "refuse") {
    return (
      <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
        Demande refusée. Le nom est de nouveau libre.{mailed ? " Le demandeur a été prévenu par e-mail." : ""}
      </p>
    );
  }
  if (result === "accept") {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          Projet accepté.
          {mailed ? " Le demandeur a reçu un e-mail avec le nom du projet, le mot de passe et un bouton pour se connecter." : ""}
        </p>
        {handover && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <p className="mb-2 font-medium">L&apos;e-mail n&apos;a pas pu être envoyé au demandeur. Transmets-lui ces infos :</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-amber-800">E-mail</dt>
              <dd className="break-all font-medium">{handover.email}</dd>
              <dt className="text-amber-800">Projet</dt>
              <dd className="font-medium">{handover.name}</dd>
              <dt className="text-amber-800">Mot de passe</dt>
              <dd className="font-medium">{handover.password ?? "(inconnu : demande-lui celui qu'il a choisi)"}</dd>
              <dt className="text-amber-800">Lien</dt>
              <dd className="break-all font-medium">{handover.loginUrl}</dd>
            </dl>
            <p className="mt-2 text-xs text-amber-800">Ces infos ne seront plus affichées après avoir quitté cette page.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => decide("refuse")}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
        >
          {loading === "refuse" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <X size={16} aria-hidden />}
          Refuser
        </button>
        <button
          type="button"
          onClick={() => decide("accept")}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading === "accept" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />}
          Accepter
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
