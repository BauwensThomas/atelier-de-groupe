"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loading } from "./Loading";

// Clé lue une seule fois (en développement, React lance les effets deux fois).
let pending: Promise<Response> | null = null;

// Arrivée par le lien professeur : on vérifie la clé, puis on ouvre le projet en lecture seule.
export function TeacherJoin({ slug }: { slug: string }) {
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pending) {
      const key = window.location.hash.slice(1);
      // La clé ne reste pas dans la barre d'adresse ni dans l'historique.
      window.history.replaceState(null, "", window.location.pathname);
      pending = fetch("/api/projects/teacher-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, key }),
      });
    }
    pending
      .then((res) => res.clone())
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; slug?: string; error?: string };
        if (res.ok && data.slug) window.location.href = `/p/${encodeURIComponent(data.slug)}`;
        else setError(data.error ?? "Ce lien ne fonctionne pas.");
      })
      .catch(() => setError("Connexion impossible. Vérifie ta connexion puis recharge la page."));
  }, [slug]);

  if (!error) return <Loading text="Ouverture du projet…" />;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-neutral-200">
        <h1 className="mb-2 text-base font-semibold">Accès professeur</h1>
        <p className="mb-4 text-sm text-neutral-600">{error}</p>
        <Link href="/" className="text-sm font-medium text-neutral-900 underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
