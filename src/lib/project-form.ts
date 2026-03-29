import type { Doc } from "@cvx/_generated/dataModel";
import { timestampToDateInputValue } from "@/lib/dates";

export type ProjectFormValues = {
  name: string;
  description: string;
  status: "planning" | "active" | "on_hold" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string;
  folderId: string;
  tagIds: string[];
  progress: number;
};

export function projectToFormValues(
  project: Doc<"projects">,
): ProjectFormValues {
  return {
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    priority: project.priority,
    dueDate: timestampToDateInputValue(project.dueDate),
    folderId: project.folderId ? String(project.folderId) : "",
    tagIds: project.tagIds.map(String),
    progress: project.progress,
  };
}

export function emptyProjectFormValues(
  defaultFolderId?: string,
): ProjectFormValues {
  return {
    name: "",
    description: "",
    status: "planning",
    priority: "medium",
    dueDate: "",
    folderId: defaultFolderId ?? "",
    tagIds: [],
    progress: 0,
  };
}
