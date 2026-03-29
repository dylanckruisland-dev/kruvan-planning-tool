import type { Doc } from "@cvx/_generated/dataModel";

export type TaskStatus = Doc<"tasks">["status"];

/** Order for grouping and Kanban columns (left → right). */
export const TASK_STATUS_ORDER: TaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "cancelled",
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

/** Solid dot color for Kanban / “by status” column headers (matches board columns). */
export const TASK_STATUS_DOT_CLASS: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-[var(--workspace-accent)]",
  done: "bg-emerald-500",
  cancelled: "bg-rose-400",
};
