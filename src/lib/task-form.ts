import type { Doc } from "@cvx/_generated/dataModel";
import type { TaskStatus } from "@/lib/task-status";
import { timestampToDateInputValue } from "@/lib/dates";

export type TaskSubtaskForm = {
  id: string;
  title: string;
  done: boolean;
};

export function createSubtaskId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `st-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function normalizeSubtasksForSave(
  items: TaskSubtaskForm[],
): { id: string; title: string; done: boolean }[] | undefined {
  const cleaned = items
    .map((s) => ({ ...s, title: s.title.trim() }))
    .filter((s) => s.title.length > 0);
  return cleaned.length === 0 ? undefined : cleaned;
}

export function taskSubtaskProgress(task: Doc<"tasks">): {
  total: number;
  done: number;
} | null {
  const list = task.subtasks;
  if (!list?.length) return null;
  const done = list.filter((s) => s.done).length;
  return { total: list.length, done };
}

export type TaskFormValues = {
  title: string;
  description: string;
  status: Doc<"tasks">["status"];
  priority: Doc<"tasks">["priority"];
  dueDate: string;
  assigneeMemberId: string;
  labelIds: string[];
  subtasks: TaskSubtaskForm[];
};

export function taskToFormValues(task: Doc<"tasks">): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    dueDate: timestampToDateInputValue(task.dueDate),
    assigneeMemberId: task.assigneeMemberId
      ? String(task.assigneeMemberId)
      : "",
    labelIds: task.labelIds.map(String),
    subtasks: (task.subtasks ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      done: s.done,
    })),
  };
}

/** Defaults for the “new task” modal (per-column status from the board/list). */
export function emptyTaskFormValues(status: TaskStatus = "todo"): TaskFormValues {
  return {
    title: "",
    description: "",
    status,
    priority: "medium",
    dueDate: "",
    assigneeMemberId: "",
    labelIds: [],
    subtasks: [],
  };
}
