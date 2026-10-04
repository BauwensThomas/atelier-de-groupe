"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

// Fenêtre de confirmation centrée, aux couleurs du site (remplace window.confirm et window.alert,
// que le navigateur affiche en haut de l'écran).

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** null : pas de bouton "Annuler" (simple information). */
  cancelLabel?: string | null;
  /** Action dangereuse : bouton rouge. */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    confirmButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(pending.cancelLabel === null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(pending.cancelLabel === null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="flex gap-3">
              {pending.danger && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <AlertTriangle size={18} aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <h2 id="confirm-title" className="font-semibold wrap-break-word">
                  {pending.title}
                </h2>
                {pending.message && (
                  <p className="mt-1 whitespace-pre-line wrap-anywhere text-sm text-neutral-600">{pending.message}</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              {pending.cancelLabel !== null && (
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50"
                >
                  {pending.cancelLabel ?? "Annuler"}
                </button>
              )}
              <button
                ref={confirmButton}
                type="button"
                onClick={() => close(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                  pending.danger ? "bg-red-600 hover:bg-red-700" : "bg-neutral-900 hover:bg-neutral-800"
                }`}
              >
                {pending.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
