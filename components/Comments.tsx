"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { Check, MessageSquare, RotateCcw, ScanText, Trash2, X } from "lucide-react";
import { COMMENT_MAX, resolveAnchor, type Author, type Message, type Thread } from "@/lib/comments";
import { FoldSection } from "./FoldSection";

function when(t: number): string {
  const d = new Date(t);
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function ProfTag() {
  return <span className="rounded bg-fuchsia-100 px-1 py-px text-[10px] font-semibold text-fuchsia-800">Professeur</span>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare size={15} aria-hidden />
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1 hover:bg-neutral-100">
            <X size={16} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Quote({ text, missing }: { text: string; missing?: boolean }) {
  return (
    <blockquote className="border-l-2 border-amber-400 pl-2 text-xs text-neutral-600 italic">
      « {text.length > 200 ? `${text.slice(0, 200)}…` : text} »
      {missing && <span className="ml-1 text-[11px] text-neutral-400 not-italic">(texte supprimé depuis)</span>}
    </blockquote>
  );
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** "@prénom" en cours de frappe juste avant le curseur, ou null. */
function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const m = text.slice(0, caret).match(/(^|\s)@([^@\n]{0,30})$/);
  return m ? { start: caret - m[2].length - 1, query: m[2] } : null;
}

type WriterProps = { placeholder: string; submit: string; names: string[]; onSubmit: (text: string) => void; autoFocus?: boolean };

// Zone de saisie : taper @ propose les prénoms du groupe (flèches, puis Entrée ou Tab pour choisir).
function Writer({ placeholder, submit, names, onSubmit, autoFocus }: WriterProps) {
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [index, setIndex] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);

  const mention = mentionQuery(text, caret);
  const suggestions = mention
    ? names.filter((n) => fold(n).startsWith(fold(mention.query)) && fold(n) !== fold(mention.query)).slice(0, 5)
    : [];
  const current = Math.min(index, Math.max(suggestions.length - 1, 0));

  const send = () => {
    if (!text.trim()) return;
    onSubmit(text);
    setText("");
  };

  function choose(name: string) {
    if (!mention) return;
    const next = `${text.slice(0, mention.start)}@${name} ${text.slice(caret)}`;
    const pos = mention.start + name.length + 2;
    setText(next);
    setCaret(pos);
    setIndex(0);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
    });
  }

  return (
    <form
      className="relative flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <textarea
        ref={area}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCaret(e.target.selectionStart);
          setIndex(0);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          if (suggestions.length) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((current + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
              return;
            }
            if ((e.key === "Enter" && !e.ctrlKey && !e.metaKey) || e.key === "Tab") {
              e.preventDefault();
              choose(suggestions[current]);
              return;
            }
            if (e.key === "Escape") {
              // Ferme seulement la liste, pas la fenêtre.
              e.preventDefault();
              e.stopPropagation();
              setCaret(-1);
              return;
            }
          }
          // Ctrl+Entrée envoie.
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send();
          }
        }}
        maxLength={COMMENT_MAX}
        rows={3}
        autoFocus={autoFocus}
        placeholder={names.length ? `${placeholder} (@ pour citer quelqu'un)` : placeholder}
        aria-label={placeholder}
        className="w-full resize-y rounded-md px-2 py-1.5 text-sm ring-1 ring-neutral-300 outline-none focus:ring-2 focus:ring-neutral-900"
      />
      {suggestions.length > 0 && (
        <ul role="listbox" aria-label="Personnes à citer" className="flex flex-col rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-neutral-200">
          {suggestions.map((n, i) => (
            <li key={n} role="option" aria-selected={i === current}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(n);
                }}
                className={`w-full px-3 py-1 text-left ${i === current ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"}`}
              >
                @{n}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="submit"
        disabled={!text.trim()}
        className="self-end rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
      >
        {submit}
      </button>
    </form>
  );
}

export function CommentComposer({
  quote,
  prof,
  names,
  onSubmit,
  onClose,
}: {
  quote: string;
  prof: boolean;
  names: string[];
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={prof ? "Note du professeur" : "Nouveau commentaire"} onClose={onClose}>
      <div className="flex flex-col gap-3 p-4">
        <Quote text={quote} />
        <Writer
          autoFocus
          names={names}
          placeholder={prof ? "Par exemple : à reformuler, à corriger…" : "Ton commentaire"}
          submit={prof ? "Ajouter la note" : "Commenter"}
          onSubmit={(text) => {
            onSubmit(text);
            onClose();
          }}
        />
      </div>
    </Modal>
  );
}

/** Texte du message, avec les @prénom cités en gras. */
function MessageText({ m }: { m: Message }) {
  if (!m.mentions.length) return <>{m.text}</>;
  const escaped = m.mentions.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const parts = m.text.split(new RegExp(`(@(?:${escaped.join("|")}))`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="rounded bg-sky-50 px-0.5 font-semibold text-sky-800">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

function MessageView({ m, children }: { m: Message; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
        <span className="font-medium" style={{ color: m.color }}>
          {m.name}
        </span>
        {m.prof && <ProfTag />}
        <span className="text-[11px] text-neutral-400">{when(m.t)}</span>
        {children}
      </div>
      <p className="text-sm whitespace-pre-wrap wrap-break-word">
        <MessageText m={m} />
      </p>
    </div>
  );
}

type ThreadProps = {
  thread: Thread;
  me: Author;
  names: string[];
  missing: boolean;
  onReply: (text: string) => void;
  onResolve: (resolved: boolean) => void;
  onDelete: () => void;
  onGoTo: () => void;
  onClose: () => void;
};

export function ThreadDialog({ thread, me, names, missing, onReply, onResolve, onDelete, onGoTo, onClose }: ThreadProps) {
  const mine = thread.uid === me.uid || (thread.name === me.name && thread.prof === me.prof);
  const doneLabel = thread.prof ? "Corrigé" : "Résolu";
  return (
    <Modal title={thread.prof ? "Note du professeur" : "Commentaire"} onClose={onClose}>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        <Quote text={thread.quote} missing={missing} />
        <MessageView m={thread} />
        {thread.replies.map((r) => (
          <div key={r.id} className="border-l border-neutral-200 pl-3">
            <MessageView m={r} />
          </div>
        ))}
        {thread.resolved && (
          <p className="flex items-center gap-1 text-xs text-green-700">
            <Check size={13} aria-hidden />
            {doneLabel} par {thread.resolved.name}, {when(thread.resolved.t)}
          </p>
        )}
        <Writer placeholder="Répondre" submit="Répondre" names={names} onSubmit={onReply} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-200 px-4 py-2.5">
        <button
          type="button"
          onClick={() => onResolve(!thread.resolved)}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
            thread.resolved ? "ring-1 ring-neutral-300 hover:bg-neutral-50" : "bg-green-700 text-white hover:bg-green-800"
          }`}
        >
          {thread.resolved ? <RotateCcw size={13} aria-hidden /> : <Check size={13} aria-hidden />}
          {thread.resolved ? "Rouvrir" : `Marquer ${doneLabel.toLowerCase()}`}
        </button>
        {!missing && (
          <button type="button" onClick={onGoTo} className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ring-1 ring-neutral-300 hover:bg-neutral-50">
            <ScanText size={13} aria-hidden />
            Voir le passage
          </button>
        )}
        {mine && (
          <button type="button" onClick={onDelete} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50">
            <Trash2 size={13} aria-hidden />
            Supprimer
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Ordre des commentaires dans le document (ceux dont le passage a disparu à la fin). */
function useOrder(editor: Editor | null, threads: Thread[]): Record<string, number> {
  return (
    useEditorState({
      editor,
      selector: ({ editor: e }) => {
        const order: Record<string, number> = {};
        if (!e) return order;
        for (const t of threads) order[t.id] = resolveAnchor(e.state, t)?.from ?? Number.MAX_SAFE_INTEGER;
        return order;
      },
    }) ?? {}
  );
}

export function CommentsPanel({
  editor,
  threads,
  unread,
  onOpen,
}: {
  editor: Editor | null;
  threads: Thread[];
  /** Commentaires où l'on est cité, pas encore ouverts. */
  unread: Set<string>;
  onOpen: (id: string) => void;
}) {
  const [showResolved, setShowResolved] = useState(false);
  const order = useOrder(editor, threads);
  const open = threads.filter((t) => !t.resolved);
  const resolved = threads.length - open.length;
  const shown = (showResolved ? threads : open)
    .slice()
    .sort((a, b) => Number(b.prof) - Number(a.prof) || (order[a.id] ?? 0) - (order[b.id] ?? 0));

  return (
    <FoldSection
      id="comments"
      title="Commentaires"
      count={open.length}
      alert={unread.size ? `${unread.size} pour toi` : undefined}
    >
      <div className="flex flex-col gap-2">
        {shown.length ? (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {shown.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onOpen(t.id)}
                  className={`flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-neutral-100 ${
                    t.prof ? "bg-fuchsia-50 ring-1 ring-fuchsia-200" : ""
                  } ${t.resolved ? "opacity-60" : ""}`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                    <span className="font-medium">{t.name}</span>
                    {t.prof && <ProfTag />}
                    {t.resolved && <Check size={12} className="text-green-700" aria-label="Résolu" />}
                    {unread.has(t.id) && (
                      <span className="rounded bg-sky-600 px-1 text-[10px] font-semibold text-white">Cité</span>
                    )}
                    {t.replies.length > 0 && (
                      <span className="ml-auto text-[11px] text-neutral-400">
                        {t.replies.length} réponse{t.replies.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-neutral-700">{t.text}</span>
                  <span className="truncate text-[11px] text-neutral-400 italic">« {t.quote} »</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-500">
            {resolved ? "Tout est résolu." : "Sélectionne un passage, puis clique sur « Commenter » dans la barre d'outils."}
          </p>
        )}
        {resolved > 0 && (
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="self-start text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
          >
            {showResolved ? "Cacher les résolus" : `Voir les résolus (${resolved})`}
          </button>
        )}
      </div>
    </FoldSection>
  );
}
