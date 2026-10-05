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
import { DocImage } from "@/lib/editor/image";
import { Pagination } from "@/lib/editor/pagination";
import { ZoomBox } from "./ZoomBox";
import { describeReason, groupVersions, versionAuthors, versionSheet, type Version } from "@/lib/versions";
import { MAIN_SHEET, type Sheet } from "@/lib/sheets";
import { useConfirm } from "./ConfirmDialog";

type Props = {
  versions: Version[];
  onClose: () => void;
  /** Enregistre toutes les feuilles ; renvoie le nombre de feuilles copiées. */
  onSaveNow: () => number;
  /** Restaure une ou plusieurs feuilles d'un enregistrement. */
  onRestore: (versions: Version[]) => void;
  /** Professeur : on regarde les versions sans pouvoir en créer ni en restaurer. */
  readOnly?: boolean;
  /** Feuilles du projet (pour nommer les feuilles de chaque enregistrement). */
  sheets: Sheet[];
};

function when(t: number): string {
  const d = new Date(t);
  const day = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const hour = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${hour}`;
}

// Ligne "Auteurs :" d'une copie, en couleur comme dans le document (ou texte libre pour les anciennes copies).
function PreviewAuthors({ version }: { version: Version }) {
  const authors = versionAuthors(version);
  if (typeof authors === "string") return authors ? <p className="mt-1 text-sm">{authors}</p> : null;
  if (!authors.length) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 text-base">
      <span>Auteurs :</span>
      {authors.map((a) => (
        <span key={a.name} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: a.color }} aria-hidden />
          <span style={{ color: a.color }}>{a.name}</span>
        </span>
      ))}
    </p>
  );
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
      DocImage,
      // Même découpe en pages que le document.
      Pagination,
    ],
  });
  return (
    <div className="page pointer-events-none select-none">
      {(version.title || version.authors) && (
        <header className="mb-6 border-b border-neutral-200 pb-4 text-center">
          {version.title && <p className="text-2xl font-bold">{version.title}</p>}
          <PreviewAuthors version={version} />
        </header>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

// Une ligne par enregistrement ; en cliquant dessus, les feuilles modifiées à ce moment-là, en onglets.
export function VersionsDialog({ versions, onClose, onSaveNow, onRestore, readOnly = false, sheets }: Props) {
  const groups = useMemo(() => groupVersions(versions), [versions]);
  const [selectedKey, setSelectedKey] = useState<string | null>(groups[0]?.key ?? null);
  const [sheetTab, setSheetTab] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const confirm = useConfirm();
  const group = groups.find((g) => g.key === selectedKey) ?? groups[0] ?? null;
  // Feuilles de l'enregistrement, dans l'ordre des onglets du document.
  const order = (v: Version) => {
    const i = sheets.findIndex((sh) => sh.id === versionSheet(v));
    return i < 0 ? sheets.length : i;
  };
  const inGroup = group ? [...group.versions].sort((a, b) => order(a) - order(b)) : [];
  const shown = inGroup.find((v) => versionSheet(v) === sheetTab) ?? inGroup[0] ?? null;
  const sheetName = (id: string) =>
    sheets.find((sh) => sh.id === id)?.name ?? (id === MAIN_SHEET ? "Document principal" : "Feuille supprimée");
  const exists = (v: Version) => sheets.some((sh) => sh.id === versionSheet(v));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function saveNow() {
    const saved = onSaveNow();
    // La nouvelle copie (la plus récente) est affichée.
    if (saved) {
      setSelectedKey(null);
      setSheetTab(null);
    }
    setMessage(
      saved === 0
        ? "Rien n'a changé depuis la dernière version."
        : saved === 1
          ? "Version enregistrée."
          : `Version enregistrée pour ${saved} feuilles.`,
    );
  }

  async function restore(list: Version[]) {
    const names = list.map((v) => `« ${sheetName(versionSheet(v))} »`).join(", ");
    const ok = await confirm({
      title: list.length > 1 ? "Restaurer toutes ces feuilles ?" : "Restaurer cette feuille ?",
      message: `${list.length > 1 ? "Les feuilles" : "La feuille"} ${names} ${list.length > 1 ? "redeviennent" : "redevient"} comme le ${when(list[0].t)}. L'état actuel est enregistré avant : tu pourras revenir en arrière.`,
      confirmLabel: "Restaurer",
    });
    if (!ok) return;
    onRestore(list);
    onClose();
  }

  const restorable = inGroup.filter(exists);

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
            {!readOnly && (
              <button
                type="button"
                onClick={saveNow}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium ring-1 ring-neutral-300 hover:bg-neutral-50"
              >
                <Save size={14} aria-hidden />
                Enregistrer une version
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1.5 hover:bg-neutral-100">
              <X size={17} aria-hidden />
            </button>
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">
            Aucune version pour le moment. Une copie est faite automatiquement toutes les 10 minutes quand le document
            change, ou tout de suite avec « Enregistrer une version ».
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <ul className="max-h-48 shrink-0 overflow-y-auto border-b border-neutral-200 md:max-h-none md:w-72 md:border-r md:border-b-0">
              {groups.map((g) => (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedKey(g.key);
                      setSheetTab(null);
                    }}
                    className={`flex w-full flex-col items-start gap-0.5 border-b border-neutral-100 px-4 py-2.5 text-left ${
                      group?.key === g.key ? "bg-neutral-100" : "hover:bg-neutral-50"
                    }`}
                  >
                    <span className="text-[13px] font-medium">{when(g.t)}</span>
                    <span className="text-xs text-neutral-600">{describeReason(g.reason)}</span>
                    {sheets.length > 1 && (
                      <span className="max-w-full truncate text-[11px] text-sky-800">
                        {g.versions.map((v) => sheetName(versionSheet(v))).join(", ")}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
                      {g.by}
                      {g.versions.length > 1 ? `, ${g.versions.length} feuilles` : `, ${g.versions[0].words} mot${g.versions[0].words > 1 ? "s" : ""}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {group && shown && (
              <div className="flex min-h-0 flex-1 flex-col">
                {inGroup.length > 1 && (
                  <div className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-neutral-50 px-3 pt-2" role="tablist" aria-label="Feuilles modifiées">
                    {inGroup.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        role="tab"
                        aria-selected={shown.id === v.id}
                        onClick={() => setSheetTab(versionSheet(v))}
                        className={`shrink-0 rounded-t-md px-3 py-1.5 text-xs ${
                          shown.id === v.id ? "bg-white font-medium ring-1 ring-neutral-200" : "text-neutral-600 hover:bg-white/70"
                        }`}
                      >
                        {sheetName(versionSheet(v))}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
                  <span className="truncate text-[13px] text-neutral-600">
                    {sheets.length > 1 ? `${sheetName(versionSheet(shown))}, ` : ""}aperçu du {when(shown.t)}, {shown.words} mot{shown.words > 1 ? "s" : ""}
                  </span>
                  {!readOnly && (
                    <div className="flex gap-2">
                      {restorable.length > 1 && (
                        <button
                          type="button"
                          onClick={() => restore(restorable)}
                          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium ring-1 ring-neutral-300 hover:bg-neutral-50"
                        >
                          <RotateCcw size={14} aria-hidden />
                          Tout restaurer ({restorable.length} feuilles)
                        </button>
                      )}
                      {exists(shown) && (
                        <button
                          type="button"
                          onClick={() => restore([shown])}
                          className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800"
                        >
                          <RotateCcw size={14} aria-hidden />
                          {inGroup.length > 1 ? "Restaurer cette feuille" : "Restaurer cette version"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto bg-neutral-100 p-3 sm:p-6">
                  {/* Page A4, réduite si la place manque, comme dans le document. */}
                  <div className="flex justify-center">
                    <ZoomBox zoom={1}>
                      <Preview key={shown.id} version={shown} />
                    </ZoomBox>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
