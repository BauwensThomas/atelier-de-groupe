"use client";

import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { FILE_TYPES, formatSize } from "@/lib/file-types";
import { fileUrl, type ProjectFile } from "@/lib/files";
import { FileIcon } from "./FileIcon";
import { FoldSection } from "./FoldSection";

const ACCEPT = Object.keys(FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

type Props = {
  files: ProjectFile[];
  /** Envois en cours : nom et pourcentage. */
  uploads: Array<{ name: string; percent: number }>;
  openId: string | null;
  editable: boolean;
  onUpload: (files: File[]) => void;
  onOpen: (file: ProjectFile) => void;
  onDelete: (file: ProjectFile) => void;
};

function day(t: number): string {
  return new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Fichiers du projet : envoyés une fois, disponibles pour tout le groupe.
export function FilesPanel({ files, uploads, openId, editable, onUpload, onOpen, onDelete }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <FoldSection id="files" title="Fichiers" count={files.length}>
      <div
        className={`flex flex-col gap-2 rounded-md ${over ? "bg-sky-50 ring-2 ring-sky-400" : ""}`}
        onDragOver={(e) => {
          if (!editable || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!editable) return;
          e.preventDefault();
          setOver(false);
          onUpload(Array.from(e.dataTransfer.files));
        }}
      >
        {editable && (
          <>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-neutral-800 ring-1 ring-neutral-300 hover:bg-neutral-50"
            >
              <Upload size={13} aria-hidden />
              Ajouter un fichier
            </button>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                onUpload(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <p className="text-[11px] text-neutral-400">Image, PDF, Word, Excel, PowerPoint… 50 Mo maximum. Tu peux aussi les glisser ici.</p>
          </>
        )}

        {uploads.map((u) => (
          <div key={u.name} className="flex flex-col gap-1 text-xs" role="status">
            <span className="truncate text-neutral-600">Envoi : {u.name}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
              <span className="block h-full bg-sky-600 transition-all" style={{ width: `${u.percent}%` }} />
            </span>
          </div>
        ))}

        {files.length ? (
          <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {files.map((f) => (
              <li key={f.id} className={`group flex items-center gap-1 rounded-md ${openId === f.id ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-neutral-100"}`}>
                <button type="button" onClick={() => onOpen(f)} title={`Ouvrir à côté du document : ${f.name}`} className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1 text-left">
                  <FileIcon ext={f.ext} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-medium">{f.name}</span>
                    <span className="truncate text-[11px] text-neutral-400">
                      {formatSize(f.size)} · {f.by || "?"} · {day(f.t)}
                    </span>
                  </span>
                </button>
                <a href={fileUrl(f, true)} title="Télécharger" aria-label={`Télécharger ${f.name}`} className="shrink-0 rounded p-1 text-neutral-400 hover:bg-white hover:text-neutral-700">
                  <Download size={13} aria-hidden />
                </a>
                {editable && (
                  <button
                    type="button"
                    onClick={() => onDelete(f)}
                    title="Supprimer"
                    aria-label={`Supprimer ${f.name}`}
                    className="shrink-0 rounded p-1 text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-red-700 focus:opacity-100"
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          !uploads.length && <p className="text-xs text-neutral-500">Aucun fichier pour le moment.</p>
        )}
      </div>
    </FoldSection>
  );
}
