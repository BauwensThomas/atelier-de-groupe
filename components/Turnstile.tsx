"use client";

import { useEffect, useRef } from "react";

// Vérification Cloudflare Turnstile. La clé de site est publique par nature (elle est faite
// pour être dans la page) ; la clé secrète reste côté serveur. Sans clé de site : rien ne s'affiche.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Turnstile indisponible"));
      document.head.appendChild(script);
    });
  }
  return loading;
}

export const turnstileActive = Boolean(SITE_KEY);

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let id: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          language: "fr",
          theme: "light",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);

  if (!SITE_KEY) return null;
  return (
    <div className="mt-3 flex min-h-[65px] justify-center">
      <div ref={ref} />
    </div>
  );
}
