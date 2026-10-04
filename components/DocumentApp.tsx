"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  shallow,
  useLostConnectionListener,
  useOthers,
  useRoom,
  useSelf,
  useClient,
  useStatus,
  useSyncStatus,
  useUpdateMyPresence,
} from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { Lock, WifiOff } from "lucide-react";
import { PROF_COLOR, saveIdentity, type Identity } from "@/lib/identity";
import { registerMember, removeMember, touchMember, useMembers } from "@/lib/members";
import { describeTransaction, logActivity, purgeObsoleteActivity, useActivity } from "@/lib/activity";
import { formatDueDate, setDueDate, useDueDate } from "@/lib/due-date";
import { addTask, deleteTask, updateTask, useTasks } from "@/lib/tasks";
import { TaskBoard, type TaskActions } from "./Tasks";
import type * as Y from "yjs";
import {
  addReply,
  addThread,
  anchorSelection,
  deleteThread,
  mentions,
  notesRoomId,
  resolveAnchor,
  setResolved,
  useThreads,
  type Author,
} from "@/lib/comments";
import { commentsKey } from "@/lib/editor/comments";
import { CommentComposer, ThreadDialog } from "./Comments";
import { uploadImage } from "@/lib/images";
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
import { useConfirm } from "./ConfirmDialog";
import { ExportChoiceDialog, printWithMode, type ColorMode } from "./PrintDialog";
import { CollapsedPanel } from "./CollapsedPanel";
import { Editor } from "./Editor";
import { IdentityDialog } from "./IdentityDialog";
import { Loading } from "./Loading";
import { SidePanel, type Person, type SyncState } from "./SidePanel";

type Props = {
  identity: Identity | null;
  identityRef: RefObject<Identity | null>;
  onIdentityChange: (identity: Identity) => void;
  /** role "prof" : lien professeur, lecture seule + commentaires. */
  project: { slug: string; name: string; role?: "prof" };
};

type Connection = "ok" | "lost" | "failed";

export function DocumentApp({ identity, identityRef, onIdentityChange, project }: Props) {
  const room = useRoom();
  const provider = useMemo(() => getYjsProviderForRoom(room), [room]);
  const readOnly = project.role === "prof";

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
    updateMyPresence({ name: identity?.name ?? "", color: identity?.color ?? "", prof: readOnly });
  }, [identity, readOnly, updateMyPresence]);

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
        prof: Boolean(o.presence.prof),
      })),
    shallow,
  );

  // Membres du projet (enregistrés dans le document) + personnes connectées en ce moment.
  const members = useMembers(provider.getYDoc());
  const joined = useRef(false);
  // Prénom ou couleur modifiés en cours de route : mise à jour de la fiche membre.
  useEffect(() => {
    if (joined.current && identity && myId && !readOnly) registerMember(provider.getYDoc(), myId, identity);
  }, [identity, myId, provider, readOnly]);

  const people = useMemo(() => {
    const byName = new Map<string, Person>();
    // Le professeur reste sur sa propre ligne, même avec le prénom d'un élève.
    const keyOf = (name: string, id: string, prof = false) => (prof ? "prof:" : "") + (name ? name.toLowerCase() : `id:${id}`);
    const me: Person = {
      key: "me", memberIds: [myId], name: identity?.name ?? "", color: identity?.color ?? "",
      me: true, online: true, typing, seen: Date.now(), prof: readOnly,
    };
    byName.set(keyOf(me.name, myId, readOnly), me);
    for (const o of others) {
      const k = keyOf(o.name, o.id, o.prof);
      const existing = byName.get(k);
      if (existing) {
        existing.online = true;
        existing.typing = existing.typing || o.typing;
        continue;
      }
      byName.set(k, { key: o.key, memberIds: [o.id], name: o.name, color: o.color, me: false, online: true, typing: o.typing, seen: Date.now(), prof: o.prof });
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
  }, [others, myId, identity, members, typing, readOnly]);

  // Journal d'activité
  const activity = useActivity(provider.getYDoc());
  const log = useCallback(
    (type: Parameters<typeof logActivity>[3], detail?: string) => {
      const who = identityRef.current;
      // Le professeur ne peut pas écrire dans le document : rien dans l'activité.
      if (who && myId && !readOnly) logActivity(provider.getYDoc(), myId, who, type, detail);
    },
    [identityRef, myId, provider, readOnly],
  );

  // Date de rendu, réglée par le groupe.
  const dueDate = useDueDate(provider.getYDoc());
  const onDueDateChange = useCallback(
    (value: string | null) => {
      setDueDate(provider.getYDoc(), value);
      log("due-date", value ? formatDueDate(value) : undefined);
    },
    [provider, log],
  );

  // Tâches du groupe.
  const tasks = useTasks(provider.getYDoc());
  const [tasksOpen, setTasksOpen] = useState(false);
  const taskPeople = useMemo(
    () => people.filter((p) => p.name && !p.prof).map((p) => ({ name: p.name, color: p.color })),
    [people],
  );
  const taskActions = useMemo<TaskActions>(
    () => ({
      editable: Boolean(identity) && !readOnly,
      people: taskPeople,
      onAdd: (text) => {
        const task = addTask(provider.getYDoc(), text);
        if (task) log("task-add", task.text.slice(0, 60));
      },
      onUpdate: (task, changes) => {
        updateTask(provider.getYDoc(), task, changes);
        if (changes.state === "done" && task.state !== "done") log("task-done", task.text.slice(0, 60));
      },
      onDelete: (task) => deleteTask(provider.getYDoc(), task.id),
    }),
    [identity, readOnly, taskPeople, provider, log],
  );

  // Une fois par jour (par navigateur d'élève) : le serveur efface les images qui ne servent plus.
  useEffect(() => {
    if (!loaded || readOnly) return;
    const key = `gp.imgClean.${project.slug}`;
    try {
      const last = Number(window.localStorage.getItem(key) ?? 0);
      if (Date.now() - last < 24 * 60 * 60 * 1000) return;
      window.localStorage.setItem(key, String(Date.now()));
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      fetch("/api/projects/clean-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: project.slug }),
      }).catch(() => null);
    }, 30_000);
    return () => clearTimeout(timer);
  }, [loaded, readOnly, project.slug]);

  // Inscription dans la liste des membres à l'ouverture.
  useEffect(() => {
    if (!loaded || !identity || !myId || joined.current || readOnly) return;
    joined.current = true;
    registerMember(provider.getYDoc(), myId, identity);
    purgeObsoleteActivity(provider.getYDoc());
  }, [loaded, identity, myId, provider, readOnly]);

  // Signe de vie toutes les minutes (pour afficher "vu à" dans la liste des membres).
  useEffect(() => {
    if (!loaded || !identity || !myId || readOnly) return;
    const timer = setInterval(() => touchMember(provider.getYDoc(), myId, identity), 60_000);
    return () => clearInterval(timer);
  }, [loaded, identity, myId, provider, readOnly]);

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

  const confirm = useConfirm();
  const onRemoveMember = useCallback(
    async (person: Person) => {
      const ok = await confirm({
        title: `Retirer ${person.name} de la liste ?`,
        message: "La personne disparaît de la liste des membres. Elle pourra revenir avec le mot de passe.",
        confirmLabel: "Retirer",
        danger: true,
      });
      if (!ok) return;
      for (const id of person.memberIds) removeMember(provider.getYDoc(), id);
    },
    [provider, confirm],
  );

  const takenColors = useMemo(
    () => new Set(others.filter((o) => o.id !== myId && o.color).map((o) => o.color)),
    [others, myId],
  );

  const [editing, setEditing] = useState(false);
  const saveChoice = useCallback(
    (next: Identity) => {
      saveIdentity(next, readOnly);
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

  // Petit message en bas de l'écran (envoi d'image, erreur…).
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = useCallback((text: string, ms = 0) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (ms) noticeTimer.current = setTimeout(() => setNotice(""), ms);
  }, []);

  const onUploadImage = useCallback(
    async (file: File) => {
      showNotice("Envoi de l'image…");
      const result = await uploadImage(project.slug, file);
      if ("error" in result) {
        showNotice(result.error, 5000);
        return null;
      }
      showNotice("");
      log("image");
      return result.src;
    },
    [project.slug, showNotice, log],
  );
  const lastEmergencySave = useRef(0);

  // Modifications faites dans l'éditeur par la personne courante.
  useEffect(() => {
    if (!editor) return;
    const onTransaction = ({ transaction }: { transaction: Parameters<typeof describeTransaction>[0] }) => {
      if (readOnly || isRemote(transaction) || !transaction.steps.length || transaction.getMeta(RESTORE_META)) return;
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
  }, [editor, log, markTyping, identityRef, provider, readOnly]);

  // Versions : copie automatique toutes les 10 minutes si le document a changé.
  // Une seule personne s'en charge : celle qui a le plus petit numéro de connexion.
  const versions = useVersions(provider.getYDoc());
  const [versionsOpen, setVersionsOpen] = useState(false);
  const othersRef = useRef(others);
  useEffect(() => {
    othersRef.current = others;
  }, [others]);
  useEffect(() => {
    if (!editor || readOnly) return;
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
  }, [editor, identityRef, myConnection, provider, readOnly]);

  const saveVersionNow = useCallback(() => {
    const who = identityRef.current;
    if (!editor || !who || readOnly) return false;
    const saved = saveVersion(provider.getYDoc(), editor.state.doc, who, "manual");
    if (saved) log("version-save");
    return saved;
  }, [editor, identityRef, provider, log, readOnly]);

  const restore = useCallback(
    (version: Version) => {
      const who = identityRef.current;
      if (!editor || !who || readOnly) return;
      restoreVersion(provider.getYDoc(), editor, version, who);
      log("version-restore", new Date(version.t).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
    },
    [editor, identityRef, provider, log, readOnly],
  );

  // Commentaires : salon à part, où le professeur a le droit d'écrire.
  const client = useClient();
  const [notes, setNotes] = useState<{ doc: Y.Doc; disconnect: () => void; connect: () => void } | null>(null);
  useEffect(() => {
    const { room: notesRoom, leave } = client.enterRoom(notesRoomId(project.slug), {
      initialPresence: { name: "", color: "" },
    });
    const notesProvider = getYjsProviderForRoom(notesRoom);
    let alive = true;
    const onSync = (synced: boolean) => {
      if (synced && alive) {
        setNotes({ doc: notesProvider.getYDoc(), disconnect: () => notesRoom.disconnect(), connect: () => notesRoom.connect() });
      }
    };
    notesProvider.on("sync", onSync);
    if (notesProvider.synced) onSync(true);
    return () => {
      alive = false;
      notesProvider.off("sync", onSync);
      leave();
    };
  }, [client, project.slug]);
  const threads = useThreads(notes?.doc ?? null);
  const [composer, setComposer] = useState<{ from: unknown; to: unknown; quote: string } | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const me = useMemo<Author | null>(
    () => (identity && myId ? { uid: myId, name: identity.name, color: identity.color, prof: readOnly } : null),
    [identity, myId, readOnly],
  );
  // Les commentaires (et celui qui est ouvert) sont transmis à l'éditeur pour le surlignage.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(commentsKey, { threads, active: openThread ?? flash }));
  }, [editor, threads, openThread, flash]);
  const onComment = useMemo(() => {
    if (!notes || !editor) return undefined;
    return () => {
      const anchor = anchorSelection(editor.state);
      if (anchor) setComposer(anchor);
    };
  }, [notes, editor]);
  const thread = openThread ? (threads.find((t) => t.id === openThread) ?? null) : null;

  // Mentions @prénom : prénoms proposés (élèves, et professeurs qui ont écrit une note), sauf le sien.
  const mentionNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of people) if (p.name && !p.prof) names.add(p.name);
    for (const t of threads) if (t.prof && t.name) names.add(t.name);
    if (identity?.name) names.delete(identity.name);
    return [...names].sort((a, b) => a.localeCompare(b, "fr"));
  }, [people, threads, identity]);

  // Messages où l'on est cité, et ceux déjà vus (retenus dans ce navigateur).
  const seenKey = `gp.mentionsSeen.${project.slug}${readOnly ? ".prof" : ""}`;
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(seenKey) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(raw)) setSeen(new Set(raw.filter((x) => typeof x === "string")));
    } catch {
      // stockage indisponible : les rappels valent pour cette page
    }
  }, [seenKey]);
  const mentionIds = useMemo(() => {
    const byThread = new Map<string, string[]>();
    if (!identity?.name || !myId) return byThread;
    for (const t of threads) {
      const ids = [t, ...t.replies].filter((m) => m.uid !== myId && mentions(m, identity.name)).map((m) => m.id);
      if (ids.length) byThread.set(t.id, ids);
    }
    return byThread;
  }, [threads, identity, myId]);
  const unreadMentions = useMemo(
    () => new Set([...mentionIds].filter(([, ids]) => ids.some((id) => !seen.has(id))).map(([threadId]) => threadId)),
    [mentionIds, seen],
  );
  // Ouvrir le commentaire suffit pour que le rappel disparaisse.
  useEffect(() => {
    const ids = openThread ? mentionIds.get(openThread) : undefined;
    if (!ids || ids.every((id) => seen.has(id))) return;
    const next = new Set([...seen, ...ids]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeen(next);
    try {
      window.localStorage.setItem(seenKey, JSON.stringify([...next].slice(-300)));
    } catch {
      // stockage indisponible
    }
  }, [openThread, mentionIds, seen, seenKey]);

  function goToThread(id: string) {
    const t = threads.find((x) => x.id === id);
    const range = editor && t ? resolveAnchor(editor.state, t) : null;
    if (!editor || !range) return;
    const { node } = editor.view.domAtPos(range.from);
    const el = node instanceof HTMLElement ? node : node.parentElement;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    setOpenThread(null);
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 2500);
  }

  const [exporting, setExporting] = useState(false);
  // Panneau de droite replié ou non (choix retenu dans ce navigateur).
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanelCollapsed(window.localStorage.getItem("gp.panelCollapsed") === "1");
    } catch {
      // stockage indisponible : panneau déplié
    }
  }, []);
  const togglePanel = useCallback((collapsed: boolean) => {
    setPanelCollapsed(collapsed);
    try {
      window.localStorage.setItem("gp.panelCollapsed", collapsed ? "1" : "0");
    } catch {
      // stockage indisponible : le choix vaut pour cette page seulement
    }
  }, []);

  // Fenêtre de choix "En couleur / Tout en noir" avant l'export Word ou l'impression.
  const [exportChoice, setExportChoice] = useState<"word" | "print" | null>(null);

  async function onExport(mode: ColorMode) {
    if (!editor) return;
    setExporting(true);
    try {
      const { exportToDocx } = await import("@/lib/export-docx");
      const doc = provider.getYDoc();
      await exportToDocx(
        editor.getJSON(),
        {
          title: doc.getText("title").toString().trim(),
          authors: doc.getText("authors").toString().trim(),
        },
        mode,
      );
    } catch {
      await confirm({ title: "Export impossible", message: "L'export a échoué. Réessaie.", confirmLabel: "OK", cancelLabel: null });
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
    const ok = await confirm({
      title: `Quitter le projet "${project.name}" ?`,
      message:
        'Tu seras retiré des membres, et il faudra le mot de passe pour revenir.\n\nPour simplement fermer ta session, utilise plutôt "Se déconnecter".',
      confirmLabel: "Quitter le projet",
      danger: true,
    });
    if (!ok) return;
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
              readOnly={readOnly}
              onOpenThread={setOpenThread}
              onComment={onComment}
              onUploadImage={readOnly ? undefined : onUploadImage}
            />
          ) : (
            <Loading text="Chargement du document…" />
          )}
        </main>

        {/* Panneau toujours visible pendant le défilement (avec sa propre barre s'il dépasse l'écran).
            Replié : colonne d'environ 1 cm (ordinateur seulement ; sur téléphone, le panneau reste complet). */}
        <aside
          className={`no-print order-first lg:sticky lg:top-4 lg:order-0 lg:max-h-[calc(100vh-2rem)] lg:shrink-0 lg:self-start lg:overflow-y-auto lg:p-px ${
            panelCollapsed ? "lg:w-12" : "lg:w-64 xl:w-72"
          }`}
        >
          {panelCollapsed && (
            <div className="hidden lg:block">
              <CollapsedPanel
                people={people}
                sync={sync}
                project={project}
                canExport={Boolean(editor)}
                onExpand={() => togglePanel(false)}
                onExport={() => setExportChoice("word")}
                onPrint={() => setExportChoice("print")}
                onOpenVersions={() => setVersionsOpen(true)}
                dueDate={dueDate}
                onOpenTasks={() => setTasksOpen(true)}
                readOnly={readOnly}
              />
            </div>
          )}
          <div className={panelCollapsed ? "lg:hidden" : ""}>
          <SidePanel
            onCollapse={() => togglePanel(true)}
            identity={identity}
            people={people}
            onRemoveMember={onRemoveMember}
            activity={activity}
            sync={sync}
            canExport={Boolean(editor)}
            exporting={exporting}
            onEdit={() => setEditing(true)}
            onExport={() => setExportChoice("word")}
            onPrint={() => setExportChoice("print")}
            onOpenVersions={() => setVersionsOpen(true)}
            versionsCount={versions.length}
            onLeave={onLeave}
            onLogout={onLogout}
            project={project}
            editor={editor}
            dueDate={dueDate}
            onDueDateChange={onDueDateChange}
            tasks={tasks}
            taskActions={taskActions}
            onOpenTasks={() => setTasksOpen(true)}
            threads={threads}
            unreadMentions={unreadMentions}
            onOpenThread={setOpenThread}
            readOnly={readOnly}
          />
          </div>
        </aside>
      </div>

      <IdleGuard
        onIdle={() => {
          room.disconnect();
          notes?.disconnect();
        }}
        onResume={() => {
          room.connect();
          notes?.connect();
        }}
      />

      {composer && me && notes && (
        <CommentComposer
          quote={composer.quote}
          prof={readOnly}
          names={mentionNames}
          onClose={() => setComposer(null)}
          onSubmit={(text) => {
            const id = addThread(notes.doc, me, composer, text, mentionNames);
            if (id) log("comment");
          }}
        />
      )}

      {thread && notes && me && (
        <ThreadDialog
          thread={thread}
          me={me}
          names={mentionNames}
          missing={!editor || !resolveAnchor(editor.state, thread)}
          onClose={() => setOpenThread(null)}
          onReply={(text) => addReply(notes.doc, me, thread.id, text, mentionNames)}
          onResolve={(resolved) => setResolved(notes.doc, thread, resolved ? me.name : null)}
          onGoTo={() => goToThread(thread.id)}
          onDelete={async () => {
            const ok = await confirm({
              title: "Supprimer ce commentaire ?",
              message: "Le commentaire et ses réponses seront supprimés pour tout le monde.",
              confirmLabel: "Supprimer",
              danger: true,
            });
            if (!ok) return;
            deleteThread(notes.doc, thread.id);
            setOpenThread(null);
          }}
        />
      )}

      {unreadMentions.size > 0 && !thread && (
        <button
          type="button"
          onClick={() => setOpenThread([...unreadMentions][0])}
          className="no-print fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white shadow-lg hover:bg-sky-800"
        >
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-sky-800">@</span>
          {unreadMentions.size === 1
            ? "Tu as été cité dans un commentaire"
            : `Tu as été cité dans ${unreadMentions.size} commentaires`}
          <span className="underline">Voir</span>
        </button>
      )}

      {notice && (
        <div
          role="status"
          className="no-print fixed bottom-4 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg"
        >
          {notice}
        </div>
      )}

      {blockedVisible && (
        <div
          role="status"
          className="no-print fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg"
        >
          <Lock size={14} aria-hidden />
          Question verrouillée
        </div>
      )}

      {exportChoice && (
        <ExportChoiceDialog
          kind={exportChoice}
          onChoose={(mode) => (exportChoice === "word" ? onExport(mode) : printWithMode(mode))}
          onClose={() => setExportChoice(null)}
        />
      )}

      {tasksOpen && <TaskBoard tasks={tasks} actions={taskActions} onClose={() => setTasksOpen(false)} />}

      {versionsOpen && (
        <VersionsDialog
          versions={versions}
          onClose={() => setVersionsOpen(false)}
          onSaveNow={saveVersionNow}
          onRestore={restore}
          readOnly={readOnly}
        />
      )}

      {showDialog && (
        <IdentityDialog
          initial={identity}
          takenColors={takenColors}
          onSave={saveChoice}
          onCancel={identity ? () => setEditing(false) : undefined}
          fixedColor={readOnly ? PROF_COLOR : undefined}
        />
      )}
    </div>
  );
}
