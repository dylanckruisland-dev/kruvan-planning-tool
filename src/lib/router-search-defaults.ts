import type { TaskDueSortDir } from "@/lib/task-due-sort";

/** Full `/projects` search object for TanStack `Link` (all keys explicit). */
export const projectsListSearch = {
  project: undefined as string | undefined,
  folder: undefined as string | undefined,
  sort: undefined as "status" | "priority" | "due" | undefined,
  dir: undefined as "asc" | "desc" | undefined,
};

/** Full `/tasks` search object for TanStack `Link`. */
export const tasksPageSearch = {
  task: undefined as string | undefined,
  taskView: undefined as "list" | "board" | undefined,
  dueSort: undefined as TaskDueSortDir | undefined,
};

/** Merge into `/projects/$projectId` `search` so `dueSort` is always set for types. */
export const projectDetailSearchBase = {
  dueSort: undefined as TaskDueSortDir | undefined,
};

/** Default `search` when opening a project (overview tab). */
export const projectDetailDefaultSearch = {
  tab: "overview" as const,
  taskView: "list" as const,
  dueSort: undefined as TaskDueSortDir | undefined,
};
