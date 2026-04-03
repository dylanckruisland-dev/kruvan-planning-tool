import type { Doc } from "@cvx/_generated/dataModel";

function startOfDayUtc(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/** Aligns with `convex/notifications.ts` (UTC calendar days). */
export type DueUrgency = "critical" | "soon" | "later";

export function dueUrgencyFromDueMs(
  dueMs: number,
  nowMs = Date.now(),
): DueUrgency {
  const sod = startOfDayUtc(nowMs);
  const dayMs = 86400000;
  const days = Math.round((startOfDayUtc(dueMs) - sod) / dayMs);
  if (days < 0) return "critical";
  if (days === 0) return "critical";
  if (days === 1) return "soon";
  return "later";
}

export function dueUrgencyTextClass(urgency: DueUrgency): string {
  switch (urgency) {
    case "critical":
      return "text-red-600";
    case "soon":
      return "text-orange-600";
    case "later":
      return "text-emerald-600";
  }
}

type TaskLike = Pick<Doc<"tasks">, "dueDate" | "status">;

/** Due date color for open tasks; neutral when missing or done/cancelled. */
export function taskDueDateTextClass(task: TaskLike): string {
  if (task.dueDate === undefined) return "text-slate-500";
  if (task.status === "done" || task.status === "cancelled") {
    return "text-slate-500";
  }
  return dueUrgencyTextClass(dueUrgencyFromDueMs(task.dueDate));
}
