"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";

// Tableau des tâches du groupe, partagé dans le document Yjs (une entrée par tâche).

export type TaskState = "todo" | "doing" | "done";
export type Task = { id: string; text: string; who: string; due: string | null; state: TaskState; t: number };

export const TASK_TEXT_MAX = 120;
export const TASK_STATES: Array<{ value: TaskState; label: string }> = [
  { value: "todo", label: "À faire" },
  { value: "doing", label: "En cours" },
  { value: "done", label: "Fini" },
];

function tasksMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("tasks");
}

function isState(value: unknown): value is TaskState {
  return value === "todo" || value === "doing" || value === "done";
}

export function readTasks(doc: Y.Doc): Task[] {
  const list: Task[] = [];
  tasksMap(doc).forEach((value, id) => {
    const v = value as Partial<Task> | null;
    if (!v || typeof v.text !== "string" || !v.text) return;
    list.push({
      id,
      text: v.text,
      who: typeof v.who === "string" ? v.who : "",
      due: typeof v.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.due) ? v.due : null,
      state: isState(v.state) ? v.state : "todo",
      t: typeof v.t === "number" ? v.t : 0,
    });
  });
  return list.sort((a, b) => a.t - b.t);
}

export function useTasks(doc: Y.Doc): Task[] {
  const [tasks, setTasks] = useState<Task[]>(() => readTasks(doc));
  useEffect(() => {
    const map = tasksMap(doc);
    const update = () => setTasks(readTasks(doc));
    map.observe(update);
    update();
    return () => map.unobserve(update);
  }, [doc]);
  return tasks;
}

export function cleanTaskText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, TASK_TEXT_MAX);
}

export function addTask(doc: Y.Doc, text: string): Task | null {
  const clean = cleanTaskText(text);
  if (!clean) return null;
  const task: Task = { id: crypto.randomUUID(), text: clean, who: "", due: null, state: "todo", t: Date.now() };
  const { id, ...data } = task;
  tasksMap(doc).set(id, data);
  return task;
}

export function updateTask(doc: Y.Doc, task: Task, changes: Partial<Omit<Task, "id" | "t">>): void {
  const { id, ...data } = { ...task, ...changes };
  tasksMap(doc).set(id, data);
}

export function deleteTask(doc: Y.Doc, id: string): void {
  tasksMap(doc).delete(id);
}
