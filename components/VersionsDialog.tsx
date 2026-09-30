"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import type { JSONContent } from "@tiptap/core";
import { History, RotateCcw, Save, X } from "lucide-react";
import { AuthorMark } from "@/lib/editor/author-mark";
import { DeletedMark } from "@/lib/editor/track-deletions";
import { Question } from "@/lib/editor/question";
import { describeReason, type Version } from "@/lib/versions";
import { useConfirm } from "./ConfirmDialog";

type Props = {
  versions: Version[];
  onClose: () => void;
  onSaveNow: () => boolean;
  onRestore: (version: Version) => void;
};

function when(t: number): string {
  const d = new Date(t);
  const day = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const hour = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${hour}`;
}

// Aperçu en lecture seule d'une version.
function Preview({ version }: { version: Version }) {
  const content = useMemo(() => JSON.parse(version.json) as JSONContent, [version.json]);
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    content,
    extensions: [
      StarterKit.configure({ undoRedo: false, heading: { levels: [1, 2, 3] }, link: false }),
      TableKit.configure({ table: { resizable: false } }),
      AuthorMark,
      DeletedMark,
      Question,
    ],
  });
  return (
    <div className="page pointer-events-none mx-auto min-h-0! select-none">
      {(version.title || version.authors) && (
        <header className="mb-6 border-b border-neutral-200 pb-4 text-center">
          {version.title && <p className="text-2xl font-bold">{version.title}</p>}
          {version.authors && <p className="mt-1 text-sm">{version.authors}</p>}
        </header>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

export function VersionsDialog({ versions, onClose, onSaveNow, onRestore }: Props) {
  const sorted = useMemo(() => [...versions].sort((a, b) => b.t - a.t), [versions]);
  const [selectedId, setSelectedId] = useState<string | null>(sorted[0]?.id ?? null);
  const [message, setMessage] = useState("");
  const confirm = useConfirm();
  const selected = sorted.find((v) => v.id === selectedId) ?? sorted[0] ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function saveNow() {
    setMessage(onSaveNow() ? "Version enregistrée." : "Rien n'a changé depuis la dernière version.");
  }

  async function restore(version: Version) {
    const ok = await confirm({
      title: "Restaurer cette version ?",
      message: `Le document redevient comme le ${when(version.t)}. La version actuelle est enregistrée avant : tu pourras revenir en arrière.`,
      confirmLabel: "Restaurer",
    });
    if (!ok) return;
    onRestore(version);
    onClose();
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-2 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="versions-title"
        className="flex h-full max-h-225 w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <h2 id="versions-title" className="flex items-center gap-2 text-base font-semibold">
            <History size={17} aria-hidden />
            Versions
          </h2>
          <div className="flex items-center gap-2">
            {message && <span className="text-xs text-neutral-500">{message}</span>}
            <button
              type="button"
              onClick={saveNow}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium ring-1 ring-neutral-300 hover:bg-neutral-50"
            >
              <Save size={14} aria-hidden />
              Enregistrer une version
            </button>
            <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1.5 hover:bg-neutral-100">
              <X size={17} aria-hidden />
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">
            Aucune version pour le moment. Une copie est faite automatiquement toutes les 10 minutes quand le document
            change, ou tout de suite avec "Enregistrer une version".
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <ul className="max-h-48 shrink-0 overflow-y-auto border-b border-neutral-200 md:max-h-none md:w-72 md:border-r md:border-b-0">
              {sorted.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className={`flex w-full flex-col items-start gap-0.5 border-b border-neutral-100 px-4 py-2.5 text-left ${
                      selected?.id === v.id ? "bg-neutral-100" : "hover:bg-neutral-50"
                    }`}
                  >
                    <span className="text-[13px] font-medium">{when(v.t)}</span>
                    <span className="text-xs text-neutral-600">{describeReason(v.reason)}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: v.color }} aria-hidden />
                      {v.by}, {v.words} mot{v.words > 1 ? "s" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {selected && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
                  <span className="text-[13px] text-neutral-600">Aperçu du {when(selected.t)}</span>
                  <button
                    type="button"
                    onClick={() => restore(selected)}
                    className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800"
                  >
                    <RotateCcw size={14} aria-hidden />
                    Restaurer cette version
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-neutral-100 p-3 sm:p-6">
                  <Preview key={selected.id} version={selected} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
