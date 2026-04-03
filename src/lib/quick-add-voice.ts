import type { Id } from "@cvx/_generated/dataModel";
import type { TaskStatus } from "@/lib/task-status";

/** Mirrors `parseVoiceCommand` action return (task / note / event). */
export type VoiceParseResult = {
  kind: "task" | "note" | "event";
  title: string;
  body: string;
  dueDate: number | null;
  projectId: Id<"projects"> | null;
  folderId: Id<"folders"> | null;
  warnings: string[];
  status: TaskStatus | null;
  priority: "low" | "medium" | "high" | "urgent" | null;
  subtaskTitles: string[];
  assigneeMemberId: Id<"workspaceMembers"> | null;
  schedStartLocal: string | null;
  schedEndLocal: string | null;
  labelIds: Id<"tags">[];
  eventStartLocal: string | null;
  eventEndLocal: string | null;
};
