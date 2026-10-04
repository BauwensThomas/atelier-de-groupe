"use client";

import { FileDown, History, LayoutGrid, LogOut, PanelRightClose, Pencil, Printer, UserMinus, X } from "lucide-react";
import { ShareButton } from "./ShareButton";
import type { Identity } from "@/lib/identity";
import type { Activity } from "@/lib/activity";
import { ActivityList } from "./ActivityList";

export type SyncState = "synced" | "syncing" | "connecting" | "offline";

export type Person = {
  key: string;
  memberIds: string[];
  name: string;
  color: string;
  me: boolean;
  online: boolean;
  typing: boolean;
  seen: number;
};

function lastSeen(time: number): string {
  if (!time) return "hors ligne";
  const days = Math.floor((Date.now() - time) / 86400000);
  if (days <= 0) return "vu aujourd'hui";
  if (days === 1) return "vu hier";
  return `vu le ${new Date(time).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

type Props = {
  identity: Identity | null;
  people: Person[];
  sync: SyncState;
  canExport: boolean;
  exporting: boolean;
  onEdit: () => void;
  onRemoveMember: (person: Person) => void;
  activity: Activity[];
  onExport: () => void;
  onPrint: () => void;
  onOpenVersions: () => void;
  versionsCount: number;
  onLeave: () => void;
  onLogout: () => void;
  project: { slug: string; name: string };
  onCollapse: () => void;
};

const SYNC_LABEL: Record<SyncState, { text: string; dot: string }> = {
  synced: { text: "Synchronisé", dot: "bg-green-600" },
  syncing: { text: "Enregistrement…", dot: "bg-amber-500" },
  connecting: { text: "Connexion…", dot: "bg-amber-500 animate-pulse" },
  offline: { text: "Hors ligne", dot: "bg-red-600" },
};

function Dot({ color }: { color: string }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color || "#d4d4d4" }} aria-hidden />;
}

export function SidePanel(props: Props) {
  const { identity, people, sync, canExport, exporting } = props;
  const status = SYNC_LABEL[sync];

  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-neutral-200">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Projet</h2>
          <div className="flex items-center gap-1">
            <a href="/" className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-800">
              <LayoutGrid size={12} aria-hidden />
              Mes projets
            </a>
            <button
              type="button"
              onClick={props.onCollapse}
              title="Replier le panneau"
              aria-label="Replier le panneau"
              className="ml-1 hidden rounded p-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 lg:block"
            >
              <PanelRightClose size={15} aria-hidden />
            </button>
          </div>
        </div>
        <p className="mb-2 truncate text-sm font-semibold" title={props.project.name}>
          {props.project.name}
        </p>
        <ShareButton slug={props.project.slug} name={props.project.name} />
      </section>

      <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Moi</h2>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Dot color={identity?.color ?? ""} />
            <span className="truncate text-sm font-medium" style={{ color: identity?.color }}>
              {identity?.name ?? "Pas encore choisi"}
            </span>
          </div>
          <button
            type="button"
            onClick={props.onEdit}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100"
          >
            <Pencil size={14} aria-hidden />
            Modifier
          </button>
        </div>
      </section>

      <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-neutral-200">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Membres ({people.filter((p) => p.online).length} en ligne)
          </h2>
          <span className="flex items-center gap-1 text-[11px] text-neutral-600" role="status">
            <span className={`h-2 w-2 rounded-full ${status.dot}`} aria-hidden />
            {status.text}
          </span>
        </div>
        <ul className="flex flex-col gap-1">
          {people.map((p) => (
            <li key={p.key} className={`group flex items-center gap-2 ${p.online ? "" : "text-neutral-500"}`}>
              <span className="relative flex shrink-0">
                <Dot color={p.color} />
                <span
                  className={`absolute -right-0.5 -bottom-0.5 h-1.5 w-1.5 rounded-full ring-2 ring-white ${p.online ? "bg-green-600" : "bg-neutral-300"}`}
                  aria-hidden
                />
              </span>
              <span className="truncate">{p.name || "Sans prénom"}</span>
              {p.me && <span className="text-[11px] text-neutral-400">(moi)</span>}
              <span className={`ml-auto shrink-0 text-[11px] ${p.typing ? "font-medium text-green-700" : "text-neutral-400"}`}>
                {p.typing ? "écrit…" : p.online ? "en ligne" : lastSeen(p.seen)}
              </span>
              {!p.online && (
                <button
                  type="button"
                  onClick={() => props.onRemoveMember(p)}
                  title="Retirer de la liste"
                  aria-label={`Retirer ${p.name} de la liste`}
                  className="shrink-0 rounded p-0.5 text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-neutral-100 hover:text-neutral-700 focus:opacity-100"
                >
                  <X size={13} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-neutral-200">
        <button
          type="button"
          onClick={props.onExport}
          disabled={!canExport || exporting}
          className="flex items-center justify-center gap-2 rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FileDown size={14} aria-hidden />
          {exporting ? "Export en cours…" : "Exporter en Word"}
        </button>
        <button
          type="button"
          onClick={props.onPrint}
          disabled={!canExport}
          className="flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-neutral-800 ring-1 ring-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Printer size={14} aria-hidden />
          Imprimer / PDF
        </button>
        <button
          type="button"
          onClick={props.onOpenVersions}
          className="flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-neutral-800 ring-1 ring-neutral-300 hover:bg-neutral-50"
        >
          <History size={14} aria-hidden />
          Versions{props.versionsCount ? ` (${props.versionsCount})` : ""}
        </button>
      </section>

      <ActivityList items={props.activity} />

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={props.onLogout}
          className="flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-neutral-800 ring-1 ring-neutral-300 hover:bg-white"
        >
          <LogOut size={14} aria-hidden />
          Se déconnecter
        </button>
        <button
          type="button"
          onClick={props.onLeave}
          className="flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-red-700 ring-1 ring-red-300 hover:bg-red-50"
        >
          <UserMinus size={14} aria-hidden />
          Quitter ce projet
        </button>
      </div>
    </div>
  );
}
