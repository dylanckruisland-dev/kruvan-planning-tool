import type { Doc } from "@cvx/_generated/dataModel";

/** Sort tasks by `dueDate` — ascending = earliest first; missing dates sort last. */
export type TaskDueSortDir = "asc" | "desc";

export function parseTaskDueSort(raw: unknown): TaskDueSortDir | undefined {
  if (raw === "asc" || raw === "desc") return raw;
  return undefined;
}

export function compareTasksByDueDate(
  a: Doc<"tasks">,
  b: Doc<"tasks">,
  asc: boolean,
): number {
  const aTime = a.dueDate;
  const bTime = b.dueDate;
  let cmp = 0;
  if (aTime == null && bTime == null) cmp = 0;
  else if (aTime == null) cmp = 1;
  else if (bTime == null) cmp = -1;
  else cmp = aTime - bTime;
  return asc ? cmp : -cmp;
}

export function sortTasksByDueDate<T extends Doc<"tasks">>(
  rows: T[],
  dir: TaskDueSortDir,
): T[] {
  return [...rows].sort((a, b) =>
    compareTasksByDueDate(a, b, dir === "asc"),
  );
}
