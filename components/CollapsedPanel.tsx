"use client";

import { FileDown, History, ListTodo, PanelRightOpen, Printer } from "lucide-react";
import type { ReactNode } from "react";
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
