"use client";

import { useEffect, useState } from "react";
import { Circle, CircleCheck, CircleDot, Columns3, ListTodo, Plus, X } from "lucide-react";
import { TASK_STATES, TASK_TEXT_MAX, type Task, type TaskState } from "@/lib/tasks";
import { daysLeft, formatDueDate, useMinuteTick } from "@/lib/due-date";
import { FoldSection } from "./FoldSection";

// Tâches du groupe : carte repliable dans le panneau, et tableau en 3 colonnes en grand.

export type TaskPerson = { name: string; color: string };

export type TaskActions = {
  editable: boolean;
  people: TaskPerson[];
  onAdd: (text: string) => void;
  onUpdate: (task: Task, changes: Partial<Omit<Task, "id" | "t">>) => void;
  onDelete: (task: Task) => void;
};

const NEXT: Record<TaskState, TaskState> = { todo: "doing", doing: "done", done: "todo" };
const LABEL: Record<TaskState, string> = { todo: "À faire", doing: "En cours", done: "Fini" };

function StateIcon({ state }: { state: TaskState }) {
  if (state === "done") return <CircleCheck size={15} className="text-green-600" aria-hidden />;
  if (state === "doing") return <CircleDot size={15} className="text-amber-500" aria-hidden />;
  return <Circle size={15} className="text-neutral-400" aria-hidden />;
}

function AddTask({ onAdd, autoFocus }: { onAdd: (text: string) => void; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd(text);
        setText("");
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={TASK_TEXT_MAX}
        autoFocus={autoFocus}
        placeholder="Nouvelle tâche"
        aria-label="Nouvelle tâche"
        className="h-7 min-w-0 flex-1 rounded-md px-2 text-xs ring-1 ring-neutral-300 outline-none focus:ring-2 focus:ring-neutral-900"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        title="Ajouter"
        aria-label="Ajouter la tâche"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40"
      >
        <Plus size={14} aria-hidden />
      </button>
    </form>
  );
}

function TaskEditor({ task, actions, onDone }: { task: Task; actions: TaskActions; onDone: () => void }) {
  const [text, setText] = useState(task.text);
  const [who, setWho] = useState(task.who);
  const [due, setDue] = useState(task.due ?? "");
  // Personne déjà choisie mais plus dans la liste des membres : on la garde dans le menu.
  const names = actions.people.map((p) => p.name);
  if (task.who && !names.includes(task.who)) names.push(task.who);

  const field = "h-7 w-full rounded-md px-2 text-xs ring-1 ring-neutral-300 outline-none focus:ring-2 focus:ring-neutral-900";
  return (
    <form
      className="flex flex-col gap-1.5 rounded-md bg-neutral-50 p-2 ring-1 ring-neutral-200"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        actions.onUpdate(task, { text, who, due: due || null });
        onDone();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDone();
      }}
    >
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={TASK_TEXT_MAX} autoFocus aria-label="Tâche" className={field} />
      <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Qui s'en charge" className={field}>
        <option value="">Personne pour l&apos;instant</option>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Pour quand" className={field} />
      <div className="flex gap-1.5">
        <button type="submit" className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800">
          OK
        </button>
        <button type="button" onClick={onDone} className="rounded-md px-2.5 py-1 text-xs ring-1 ring-neutral-300 hover:bg-white">
          Annuler
        </button>
        <button
          type="button"
          onClick={() => {
            actions.onDelete(task);
            onDone();
          }}
          className="ml-auto rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        >
          Supprimer
        </button>
      </div>
    </form>
  );
}

function TaskRow({ task, actions }: { task: Task; actions: TaskActions }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <TaskEditor task={task} actions={actions} onDone={() => setEditing(false)} />;

  const person = actions.people.find((p) => p.name === task.who);
  const late = task.due && task.state !== "done" && daysLeft(task.due) < 0;
  const done = task.state === "done";

  return (
    <div className="flex items-start gap-1.5">
      <button
        type="button"
        disabled={!actions.editable}
        onClick={() => actions.onUpdate(task, { state: NEXT[task.state] })}
        title={`${LABEL[task.state]} (clic : ${LABEL[NEXT[task.state]].toLowerCase()})`}
        aria-label={`${task.text} : ${LABEL[task.state]}. Passer à ${LABEL[NEXT[task.state]]}`}
        className="mt-px shrink-0 rounded p-0.5 hover:bg-neutral-100 disabled:hover:bg-transparent"
      >
        <StateIcon state={task.state} />
      </button>
      <button
        type="button"
        disabled={!actions.editable}
        onClick={() => setEditing(true)}
        title={actions.editable ? "Modifier la tâche" : undefined}
        className="min-w-0 flex-1 rounded px-1 py-0.5 text-left text-xs hover:bg-neutral-100 disabled:hover:bg-transparent"
      >
        <span className={`block wrap-break-word ${done ? "text-neutral-400 line-through" : ""}`}>{task.text}</span>
        {(task.who || task.due) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-neutral-500">
            {task.who && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: person?.color ?? "#9ca3af" }} aria-hidden />
                {task.who}
              </span>
            )}
            {task.due && (
              <span className={late ? "font-medium text-red-600" : ""}>
                {late ? "En retard : " : "Pour le "}
                {formatDueDate(task.due, true)}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  );
}

function Column({ state, tasks, actions }: { state: TaskState; tasks: Task[]; actions: TaskActions }) {
  const list = tasks.filter((t) => t.state === state);
  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-lg bg-neutral-100 p-2">
      <h3 className="flex items-center gap-1.5 px-1 text-xs font-semibold text-neutral-700">
        <StateIcon state={state} />
        {LABEL[state]}
        <span className="font-normal text-neutral-400">({list.length})</span>
      </h3>
      {state === "todo" && actions.editable && <AddTask onAdd={actions.onAdd} autoFocus />}
      <ul className="flex flex-col gap-1.5 overflow-y-auto">
        {list.map((t) => (
          <li key={t.id} className="rounded-md bg-white p-1.5 shadow-sm ring-1 ring-neutral-200">
            <TaskRow task={t} actions={actions} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TaskBoard({ tasks, actions, onClose }: { tasks: Task[]; actions: TaskActions; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Échap ferme le tableau, sauf pendant la modification d'une tâche (le formulaire s'en charge).
      if (e.key === "Escape" && !(e.target instanceof HTMLElement && e.target.closest("form"))) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-2 sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="tasks-title" className="flex h-full max-h-225 w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <h2 id="tasks-title" className="flex items-center gap-2 text-base font-semibold">
            <ListTodo size={17} aria-hidden />
            Tâches du groupe
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1.5 hover:bg-neutral-100">
            <X size={17} aria-hidden />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:grid-cols-3">
          {TASK_STATES.map((s) => (
            <Column key={s.value} state={s.value} tasks={tasks} actions={actions} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TaskPanel({ tasks, actions, onOpenBoard }: { tasks: Task[]; actions: TaskActions; onOpenBoard: () => void }) {
  useMinuteTick();
  const open = tasks.filter((t) => t.state !== "done");
  const done = tasks.length - open.length;
  // En cours d'abord, puis à faire.
  const sorted = [...open].sort((a, b) => Number(b.state === "doing") - Number(a.state === "doing"));

  return (
    <FoldSection id="tasks" title="Tâches" count={open.length}>
      <div className="flex flex-col gap-2">
        {actions.editable && <AddTask onAdd={actions.onAdd} />}
        {sorted.length ? (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {sorted.map((t) => (
              <li key={t.id}>
                <TaskRow task={t} actions={actions} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-500">{tasks.length ? "Tout est fini." : "Aucune tâche pour le moment."}</p>
        )}
        <button
          type="button"
          onClick={onOpenBoard}
          className="flex items-center gap-1.5 self-start text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          <Columns3 size={13} aria-hidden />
          Ouvrir le tableau{done ? ` (${done} finie${done > 1 ? "s" : ""})` : ""}
        </button>
      </div>
    </FoldSection>
  );
}
