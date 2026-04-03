import type { MentionKind } from "@/lib/mention-utils";
import {
  projectDetailDefaultSearch,
  tasksPageSearch,
} from "@/lib/router-search-defaults";

/** Navigation target for `useNavigate` from TanStack Router. */
export type MentionNavigateTarget =
  | {
      to: "/tasks";
      search: {
        task: string;
        taskView?: "list" | "board";
        dueSort?: "asc" | "desc";
      };
    }
  | { to: "/notes"; search: { note: string } }
  | {
      to: "/projects/$projectId";
      params: { projectId: string };
      search: typeof projectDetailDefaultSearch;
    }
  | { to: "/agenda"; search: { event: string } }
  | {
      to: "/content";
      search: { content: string; view?: "calendar" | "board" };
    }
  | { to: "/settings" };

export function getMentionNavigateTarget(
  kind: MentionKind,
  id: string,
): MentionNavigateTarget | null {
  if (!id.trim()) return null;
  switch (kind) {
    case "task":
      return {
        to: "/tasks",
        search: { ...tasksPageSearch, task: id, taskView: "list" },
      };
    case "note":
      return { to: "/notes", search: { note: id } };
    case "project":
      return {
        to: "/projects/$projectId",
        params: { projectId: id },
        search: { ...projectDetailDefaultSearch },
      };
    case "event":
      return { to: "/agenda", search: { event: id } };
    case "content":
      return { to: "/content", search: { content: id } };
    case "assignee":
      return { to: "/settings" };
    default:
      return null;
  }
}
