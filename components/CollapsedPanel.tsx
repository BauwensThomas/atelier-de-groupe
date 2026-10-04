"use client";

import { Check, FileDown, Folder, History, ListTodo, MessageSquare, PanelRightOpen, Printer, Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Flyout } from "./Flyout";
import { FileIcon } from "./FileIcon";
import { FILE_TYPES } from "@/lib/file-types";
import type { ProjectFile } from "@/lib/files";
import type { Thread } from "@/lib/comments";
import { ShareButton } from "./ShareButton";
import type { Person, SyncState } from "./SidePanel";
import { countdown, formatDueDate, useMinuteTick } from "@/lib/due-date";

// Panneau replié (environ 1 cm) : statut, personnes connectées et raccourcis restent visibles.

type Props = {
  people: Person[];
  sync: SyncState;
  project: { slug: string; name: string };
  canExport: boolean;
  onExpand: () => void;
  onExport: () => void;
  onPrint: () => void;
  onOpenVersions: () => void;
  dueDate: string | null;
  onOpenTasks: () => void;
  readOnly: boolean;
  files: ProjectFile[];
  onOpenFile: (file: ProjectFile) => void;
  onUploadFiles: (files: File[]) => void;
  threads: Thread[];
  unreadMentions: Set<string>;
  onOpenThread: (id: string) => void;
};

const SYNC: Record<SyncState, { text: string; dot: string }> = {
  synced: { text: "Synchronisé", dot: "bg-green-600" },
  syncing: { text: "Enregistrement…", dot: "bg-amber-500" },
  connecting: { text: "Connexion…", dot: "bg-amber-500 animate-pulse" },
  offline: { text: "Hors ligne", dot: "bg-red-600" },
};

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function CollapsedPanel(props: Props) {
  const online = props.people.filter((p) => p.online && !p.prof);
  const profOnline = props.people.some((p) => p.online && p.prof && !p.me);
  const status = SYNC[props.sync];
  useMinuteTick();
  const left = props.dueDate ? countdown(props.dueDate) : null;
  const upload = useRef<HTMLInputElement>(null);
  const openThreads = props.threads.filter((t) => !t.resolved);
  const resolvedCount = props.threads.length - openThreads.length;
  const [showResolved, setShowResolved] = useState(false);
  const listed = showResolved ? props.threads : openThreads;

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-white py-2 shadow-sm ring-1 ring-neutral-200">
      <IconButton label="Afficher le panneau" onClick={props.onExpand}>
        <PanelRightOpen size={17} aria-hidden />
      </IconButton>

      <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} title={status.text} aria-label={status.text} role="status" />

      {left && props.dueDate && (
        <span
          title={`Rendu le ${formatDueDate(props.dueDate)}`}
          className={`rounded px-1 py-0.5 text-[10px] font-semibold leading-none tabular-nums ${left.tone}`}
        >
          {left.text === "Date dépassée" ? "Fini" : left.text === "Aujourd'hui" ? "J-0" : left.text}
        </span>
      )}

      <span className="h-px w-6 bg-neutral-200" aria-hidden />

      {/* Personnes connectées : initiale dans la couleur de chacun, le rond pulse pendant la frappe */}
      {profOnline && !props.readOnly && (
        <span
          title="Professeur connecté"
          aria-label="Professeur connecté"
          role="status"
          className="flex h-7 w-7 animate-pulse items-center justify-center rounded-full bg-fuchsia-600 text-[10px] font-bold text-white"
        >
          Prof
        </span>
      )}

      {/* Le professeur ne voit pas qui est en ligne. */}
      {!props.readOnly && (
      <ul className="flex flex-col items-center gap-1.5" aria-label="Personnes en ligne">
        {online.map((p) => (
          <li key={p.key}>
            <span
              title={`${p.name || "Sans prénom"}${p.me ? " (moi)" : ""}${p.prof ? " (professeur)" : ""}${p.typing ? " : écrit…" : " : en ligne"}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ${
                p.typing ? "animate-pulse ring-2 ring-green-500 ring-offset-1" : p.prof ? "ring-2 ring-fuchsia-500 ring-offset-1" : ""
              }`}
              style={{ backgroundColor: p.color || "#9ca3af" }}
            >
              {(p.name || "?").charAt(0).toUpperCase()}
            </span>
          </li>
        ))}
      </ul>
      )}

      <span className="h-px w-6 bg-neutral-200" aria-hidden />

      {/* Commentaires : nombre de commentaires ouverts, et @ quand on est cité. */}
      <Flyout
        label="Commentaires"
        title="Commentaires"
        icon={<MessageSquare size={16} aria-hidden />}
        badge={
          props.unreadMentions.size > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-0.5 text-[9px] font-bold text-white">@</span>
          ) : openThreads.length > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-700 px-0.5 text-[9px] font-bold text-white">
              {openThreads.length}
            </span>
          ) : null
        }
      >
        {(close) => (
          <div className="flex flex-col gap-1">
          {listed.length ? (
            <ul className="flex flex-col gap-0.5">
              {listed.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      props.onOpenThread(t.id);
                    }}
                    className={`flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-neutral-100 ${t.prof ? "bg-fuchsia-50" : ""} ${t.resolved ? "opacity-60" : ""}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                      <span className="font-medium">{t.name}</span>
                      {t.resolved && <Check size={12} className="text-green-700" aria-label="Résolu" />}
                      {props.unreadMentions.has(t.id) && <span className="rounded bg-sky-600 px-1 text-[10px] font-semibold text-white">Cité</span>}
                    </span>
                    <span className="line-clamp-2 text-neutral-700">{t.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-2 text-xs text-neutral-500">{resolvedCount ? "Tout est résolu." : "Aucun commentaire."}</p>
          )}
          {resolvedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowResolved((v) => !v)}
              className="self-start px-2 py-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
            >
              {showResolved ? "Cacher les résolus" : `Voir les résolus (${resolvedCount})`}
            </button>
          )}
          </div>
        )}
      </Flyout>

      {/* Fichiers du projet (pas pour le professeur) : ouvrir à côté du document, ou en ajouter. */}
      {!props.readOnly && (
        <Flyout
          label="Fichiers"
          title="Fichiers du projet"
          icon={<Folder size={16} aria-hidden />}
          badge={
            props.files.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-700 px-0.5 text-[9px] font-bold text-white">
                {props.files.length}
              </span>
            ) : null
          }
        >
          {(close) => (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => upload.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium ring-1 ring-neutral-300 hover:bg-neutral-50"
              >
                <Upload size={13} aria-hidden />
                Ajouter un fichier
              </button>
              <input
                ref={upload}
                type="file"
                multiple
                accept={Object.keys(FILE_TYPES).map((e) => `.${e}`).join(",")}
                className="hidden"
                onChange={(e) => {
                  props.onUploadFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                  close();
                }}
              />
              {props.files.length ? (
                <ul className="flex flex-col gap-0.5">
                  {props.files.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          props.onOpenFile(f);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-neutral-100"
                      >
                        <FileIcon ext={f.ext} />
                        <span className="truncate">{f.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-2 text-xs text-neutral-500">Aucun fichier pour le moment.</p>
              )}
            </div>
          )}
        </Flyout>
      )}

      <span className="h-px w-6 bg-neutral-200" aria-hidden />

      {!props.readOnly && <ShareButton slug={props.project.slug} name={props.project.name} compact />}
      {!props.readOnly && (
      <>
      <IconButton label="Exporter en Word" onClick={props.onExport} disabled={!props.canExport}>
        <FileDown size={16} aria-hidden />
      </IconButton>
      <IconButton label="Imprimer / PDF" onClick={props.onPrint} disabled={!props.canExport}>
        <Printer size={16} aria-hidden />
      </IconButton>
      <IconButton label="Tâches" onClick={props.onOpenTasks}>
        <ListTodo size={16} aria-hidden />
      </IconButton>
      <IconButton label="Versions" onClick={props.onOpenVersions}>
        <History size={16} aria-hidden />
      </IconButton>
      </>
      )}
    </div>
  );
}
