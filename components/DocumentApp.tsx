"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  shallow,
  useLostConnectionListener,
  useOthers,
  useRoom,
  useSelf,
  useStatus,
  useSyncStatus,
  useUpdateMyPresence,
} from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { Lock, WifiOff } from "lucide-react";
import { saveIdentity, type Identity } from "@/lib/identity";
import { registerMember, removeMember, touchMember, useMembers } from "@/lib/members";
import { describeTransaction, logActivity, purgeObsoleteActivity, useActivity } from "@/lib/activity";
import { isRemote } from "@/lib/editor/shared";
import {
  AUTO_INTERVAL_MS,
  RESTORE_META,
  isBigDeletion,
  lastVersion,
  restoreVersion,
  saveVersion,
  useVersions,
  type Version,
} from "@/lib/versions";
import { VersionsDialog } from "./VersionsDialog";
import { IdleGuard } from "./IdleGuard";
import { Editor } from "./Editor";
import { IdentityDialog } from "./IdentityDialog";
import { Loading } from "./Loading";
import { SidePanel, type Person, type SyncState } from "./SidePanel";

type Props = {
  identity: Identity | null;
  identityRef: RefObject<Identity | null>;
  onIdentityChange: (identity: Identity) => void;
  project: { slug: string; name: string };
};

type Connection = "ok" | "lost" | "failed";

export function DocumentApp({ identity, identityRef, onIdentityChange, project }: Props) {
  const room = useRoom();
  const provider = useMemo(() => getYjsProviderForRoom(room), [room]);

  // Une fois le document chargé, on garde l'éditeur affiché même en cas de coupure.
  const [loaded, setLoaded] = useState(() => provider.synced);
  useEffect(() => {
    const onSync = (synced: boolean) => {
      if (synced) setLoaded(true);
    };
    provider.on("sync", onSync);
    if (provider.synced) onSync(true);
    return () => provider.off("sync", onSync);
  }, [provider]);

  const status = useStatus();
  const syncStatus = useSyncStatus({ smooth: true });
  const [connection, setConnection] = useState<Connection>("ok");
  useLostConnectionListener((event) => {
    setConnection(event === "restored" ? "ok" : event === "lost" ? "lost" : "failed");
  });

  let sync: SyncState = "connecting";
  if (status === "connected") sync = syncStatus === "synchronized" ? "synced" : "syncing";
  else if (status === "disconnected") sync = "offline";

  // Présence : prénom et couleur visibles par les autres.
  const updateMyPresence = useUpdateMyPresence();
  useEffect(() => {
    updateMyPresence({ name: identity?.name ?? "", color: identity?.color ?? "" });
  }, [identity, updateMyPresence]);

  const myId = useSelf((me) => me.id);
  const myConnection = useSelf((me) => me.connectionId);
  const [typing, setTyping] = useState(false);
  const others = useOthers(
    (list) =>
      list.map((o) => ({
        key: String(o.connectionId),
        id: o.id,
        name: o.presence.name,
        color: o.presence.color,
        typing: Boolean(o.presence.typing),
      })),
    shallow,
  );

  // Membres du projet (enregistrés dans le document) + personnes connectées en ce moment.
  const members = useMembers(provider.getYDoc());
  const joined = useRef(false);
  // Prénom ou couleur modifiés en cours de route : mise à jour de la fiche membre.
  useEffect(() => {
    if (joined.current && identity && myId) registerMember(provider.getYDoc(), myId, identity);
  }, [identity, myId, provider]);

  const people = useMemo(() => {
    const byName = new Map<string, Person>();
    const keyOf = (name: string, id: string) => (name ? name.toLowerCase() : `id:${id}`);
    const me: Person = {
      key: "me", memberIds: [myId], name: identity?.name ?? "", color: identity?.color ?? "",
      me: true, online: true, typing, seen: Date.now(),
    };
    byName.set(keyOf(me.name, myId), me);
    for (const o of others) {
      const k = keyOf(o.name, o.id);
      const existing = byName.get(k);
      if (existing) {
        existing.online = true;
        existing.typing = existing.typing || o.typing;
        continue;
      }
      byName.set(k, { key: o.key, memberIds: [o.id], name: o.name, color: o.color, me: false, online: true, typing: o.typing, seen: Date.now() });
    }
    for (const m of members) {
      const k = keyOf(m.name, m.id);
      const existing = byName.get(k);
      if (existing) {
        if (!existing.memberIds.includes(m.id)) existing.memberIds.push(m.id);
        continue;
      }
      byName.set(k, { key: `m:${m.id}`, memberIds: [m.id], name: m.name, color: m.color, me: false, online: false, typing: false, seen: m.seen });
    }
    for (const p of byName.values()) {
      if (!p.online) p.seen = Math.max(...members.filter((m) => p.memberIds.includes(m.id)).map((m) => m.seen), 0);
    }
    return [...byName.values()].sort(
      (a, b) =>
        Number(b.me) - Number(a.me) ||
        Number(b.online) - Number(a.online) ||
        a.name.localeCompare(b.name, "fr"),
    );
  }, [others, myId, identity, members, typing]);

  // Journal d'activité
  const activity = useActivity(provider.getYDoc());
  const log = useCallback(
    (type: Parameters<typeof logActivity>[3], detail?: string) => {
      const who = identityRef.current;
      if (who && myId) logActivity(provider.getYDoc(), myId, who, type, detail);
    },
    [identityRef, myId, provider],
  );

  // Inscription dans la liste des membres à l'ouverture.
  useEffect(() => {
    if (!loaded || !identity || !myId || joined.current) return;
    joined.current = true;
    registerMember(provider.getYDoc(), myId, identity);
    purgeObsoleteActivity(provider.getYDoc());
  }, [loaded, identity, myId, provider]);

  // Signe de vie toutes les minutes (pour afficher "vu à" dans la liste des membres).
  useEffect(() => {
    if (!loaded || !identity || !myId) return;
    const timer = setInterval(() => touchMember(provider.getYDoc(), myId, identity), 60_000);
    return () => clearInterval(timer);
  }, [loaded, identity, myId, provider]);

  // "écrit…" dans la liste des membres : visible par tous pendant la frappe, puis 3 s après.
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markTyping = useCallback(() => {
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 3000);
  }, []);
  useEffect(() => {
    updateMyPresence({ typing });
  }, [typing, updateMyPresence]);

  const onRemoveMember = useCallback(
    (person: Person) => {
      if (!window.confirm(`Retirer ${person.name} de la liste des membres ?`)) return;
      for (const id of person.memberIds) removeMember(provider.getYDoc(), id);
    },
    [provider],
  );

  const takenColors = useMemo(
    () => new Set(others.filter((o) => o.id !== myId && o.color).map((o) => o.color)),
    [others, myId],
  );

  const [editing, setEditing] = useState(false);
  const saveChoice = useCallback(
    (next: Identity) => {
      saveIdentity(next);
      onIdentityChange(next);
      setEditing(false);
    },
    [onIdentityChange],
  );

  // Message discret quand on essaie de modifier une question verrouillée.
  const [blockedVisible, setBlockedVisible] = useState(false);
  const blockedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBlocked = useCallback(() => {
    setBlockedVisible(true);
    if (blockedTimer.current) clearTimeout(blockedTimer.current);
    blockedTimer.current = setTimeout(() => setBlockedVisible(false), 1800);
  }, []);

  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const lastEmergencySave = useRef(0);

  // Modifications faites dans l'éditeur par la personne courante.
  useEffect(() => {
    if (!editor) return;
    const onTransaction = ({ transaction }: { transaction: Parameters<typeof describeTransaction>[0] }) => {
      if (isRemote(transaction) || !transaction.steps.length || transaction.getMeta(RESTORE_META)) return;
      // Grosse suppression : on garde une copie de l'état d'avant (au plus une par minute).
      const who = identityRef.current;
      if (who && transaction.docChanged && isBigDeletion(transaction.before, transaction.doc)) {
        const now = Date.now();
        if (now - lastEmergencySave.current > 60_000) {
          lastEmergencySave.current = now;
          saveVersion(provider.getYDoc(), transaction.before, who, "before-delete");
        }
      }
      const items = describeTransaction(transaction);
      if (items.some((item) => item.type === "write" || item.type === "erase")) markTyping();
      for (const item of items) if (item.type !== "write") log(item.type, item.detail);
    };
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor, log, markTyping, identityRef, provider]);

  // Versions : copie automatique toutes les 10 minutes si le document a changé.
  // Une seule personne s'en charge : celle qui a le plus petit numéro de connexion.
  const versions = useVersions(provider.getYDoc());
  const [versionsOpen, setVersionsOpen] = useState(false);
  const othersRef = useRef(others);
  useEffect(() => {
    othersRef.current = others;
  }, [others]);
  useEffect(() => {
    if (!editor) return;
    const tick = () => {
      const who = identityRef.current;
      if (!who) return;
      const leader = othersRef.current.every((o) => Number(o.key) > myConnection);
      if (!leader) return;
      const doc = provider.getYDoc();
      const last = lastVersion(doc);
      if (last && Date.now() - last.t < AUTO_INTERVAL_MS) return;
      saveVersion(doc, editor.state.doc, who, "auto");
    };
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [editor, identityRef, myConnection, provider]);

  const saveVersionNow = useCallback(() => {
    const who = identityRef.current;
    if (!editor || !who) return false;
    const saved = saveVersion(provider.getYDoc(), editor.state.doc, who, "manual");
    if (saved) log("version-save");
    return saved;
  }, [editor, identityRef, provider, log]);

  const restore = useCallback(
    (version: Version) => {
      const who = identityRef.current;
      if (!editor || !who) return;
      restoreVersion(provider.getYDoc(), editor, version, who);
      log("version-restore", new Date(version.t).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
    },
    [editor, identityRef, provider, log],
  );
  const [exporting, setExporting] = useState(false);

  async function onExport() {
    if (!editor) return;
    setExporting(true);
    try {
      const { exportToDocx } = await import("@/lib/export-docx");
      const doc = provider.getYDoc();
      await exportToDocx(editor.getJSON(), {
        title: doc.getText("title").toString().trim(),
        authors: doc.getText("authors").toString().trim(),
      });
    } catch {
      window.alert("L'export a échoué. Réessaie.");
    }
    setExporting(false);
  }

  // Se déconnecter : oublie les projets sur cet appareil, mais on reste membre (juste "hors ligne").
  async function onLogout() {
    await fetch("/api/projects/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/";
  }

  // Quitter le projet : on sort du groupe (retiré de la liste des membres).
  async function onLeave() {
    if (
      !window.confirm(
        `Quitter le projet "${project.name}" ? Tu seras retiré des membres, et il faudra le mot de passe pour revenir.\n\nPour simplement fermer ta session, utilise plutôt "Se déconnecter".`,
      )
    )
      return;
    // On retire sa fiche de la liste des membres, et on attend qu'elle soit bien envoyée (3 s max).
    if (myId) {
      removeMember(provider.getYDoc(), myId);
      const start = Date.now();
      while (provider.getStatus() !== "synchronized" && Date.now() - start < 3000) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    await fetch("/api/projects/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: project.slug }),
    }).catch(() => null);
    window.location.href = "/";
  }

  const showDialog = !identity || editing;

  return (
    <div className="min-h-screen">
      {connection !== "ok" && (
        <div className="no-print sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          <WifiOff size={15} aria-hidden />
          {connection === "lost"
            ? "Connexion perdue. Reconnexion en cours, tes modifications sont gardées."
            : "Impossible de se reconnecter. Vérifie ta connexion puis recharge la page."}
        </div>
      )}

      <div className="print-reset flex flex-col gap-4 p-2 sm:p-4 lg:flex-row lg:items-start">
        {/* overflow-clip (et non overflow-hidden) : garde les coins arrondis sans empêcher la barre d'outils de rester en haut */}
        <main className="print-reset min-w-0 flex-1 overflow-clip rounded-xl bg-neutral-200/60 ring-1 ring-neutral-200">
          {loaded ? (
            <Editor
              provider={provider}
              identity={identity}
              identityRef={identityRef}
              onBlocked={onBlocked}
              onReady={setEditor}
              onHeaderEdited={(field) => {
                markTyping();
                log(field);
              }}
            />
          ) : (
            <Loading text="Chargement du document…" />
          )}
        </main>

        {/* Panneau toujours visible pendant le défilement (avec sa propre barre s'il dépasse l'écran) */}
        <aside className="no-print order-first lg:sticky lg:top-4 lg:order-0 lg:max-h-[calc(100vh-2rem)] lg:w-64 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:p-px xl:w-72">
          <SidePanel
            identity={identity}
            people={people}
            onRemoveMember={onRemoveMember}
            activity={activity}
            sync={sync}
            canExport={Boolean(editor)}
            exporting={exporting}
            onEdit={() => setEditing(true)}
            onExport={onExport}
            onPrint={() => window.print()}
            onOpenVersions={() => setVersionsOpen(true)}
            versionsCount={versions.length}
            onLeave={onLeave}
            onLogout={onLogout}
            project={project}
          />
        </aside>
      </div>

      <IdleGuard onIdle={() => room.disconnect()} onResume={() => room.connect()} />

      {blockedVisible && (
        <div
          role="status"
          className="no-print fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg"
        >
          <Lock size={14} aria-hidden />
          Question verrouillée
        </div>
      )}

      {versionsOpen && (
        <VersionsDialog
          versions={versions}
          onClose={() => setVersionsOpen(false)}
          onSaveNow={saveVersionNow}
          onRestore={restore}
        />
      )}

      {showDialog && (
        <IdentityDialog
          initial={identity}
          takenColors={takenColors}
          onSave={saveChoice}
          onCancel={identity ? () => setEditing(false) : undefined}
        />
      )}
    </div>
  );
}
