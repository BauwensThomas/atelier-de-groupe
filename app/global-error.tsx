"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Erreur grave qui empêche d'afficher le site : elle est envoyée à Sentry, et on propose de recharger.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f5f5f5", margin: 0 }}>
        <main style={{ maxWidth: 420, margin: "15vh auto", padding: 24, background: "#fff", borderRadius: 12, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Un problème est survenu</h1>
          <p style={{ fontSize: 14, color: "#525252", marginBottom: 16 }}>
            Le problème a été signalé automatiquement. Recharge la page : ton travail est enregistré.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: "#171717", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}
          >
            Recharger la page
          </button>
        </main>
      </body>
    </html>
  );
}
