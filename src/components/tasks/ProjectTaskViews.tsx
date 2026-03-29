import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@cvx/_generated/api";
import { ProjectTaskBoard } from "@/components/tasks/ProjectTaskBoard";
import { ProjectTaskListByStatus } from "@/components/tasks/ProjectTaskListByStatus";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { cn } from "@/lib/cn";
import type { TaskStatus } from "@/lib/task-status";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { Columns3, LayoutList } from "lucide-react";

type TaskModalState =
  | { kind: "edit"; taskId: Id<"tasks"> }
  | { kind: "create"; status: TaskStatus };

type Task = Doc<"tasks">;

type Props = {
  projectId: Id<"projects">;
  workspaceId: Id<"workspaces">;
  projectName: string;
  tasks: Task[] | undefined;
  taskView: "list" | "board";
  memberName: Map<string, string>;
  legacyUserName: Map<string, string>;
  tagMap: Map<string, string>;
  workspaceMembers: Doc<"workspaceMembers">[];
  tags: Doc<"tags">[];
};

export function ProjectTaskViews({
  projectId,
  workspaceId,
  projectName,
  tasks,
  taskView,
  memberName,
  legacyUserName,
  tagMap,
  workspaceMembers,
  tags,
}: Props) {
  const toggleComplete = useMutation(api.tasks.toggleComplete);
  const [taskModal, setTaskModal] = useState<TaskModalState | null>(null);

  function onToggleTask(taskId: Id<"tasks">) {
    void toggleComplete({ taskId });
  }

  const list = useMemo(() => tasks ?? [], [tasks]);

  const editingTask = useMemo(
    () =>
      taskModal?.kind === "edit"
        ? (list.find((t) => t._id === taskModal.taskId) ?? null)
        : null,
    [list, taskModal],
  );

  const modalOpen =
    taskModal !== null &&
    (taskModal.kind === "create" || editingTask !== null);

  return (
    <div className="space-y-4">
      <TaskEditModal
        open={modalOpen}
        onClose={() => setTaskModal(null)}
        task={taskModal?.kind === "create" ? null : editingTask}
        workspaceId={workspaceId}
        projectId={projectId}
        projectName={projectName}
        workspaceMembers={workspaceMembers}
        tags={tags}
        createInitialStatus={
          taskModal?.kind === "create" ? taskModal.status : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-slate-200/90 bg-slate-50/80 p-1 shadow-sm">
          <Link
            to="/projects/$projectId"
            params={{ projectId: String(projectId) }}
            search={{ tab: "tasks", taskView: "list" }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              taskView === "list"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            By status
          </Link>
          <Link
            to="/projects/$projectId"
            params={{ projectId: String(projectId) }}
            search={{ tab: "tasks", taskView: "board" }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              taskView === "board"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Board
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setTaskModal({ kind: "create", status: "todo" })}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Add task
        </button>
      </div>

      {tasks === undefined ? (
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
      ) : taskView === "list" ? (
        <ProjectTaskListByStatus
          tasks={list}
          memberName={memberName}
          legacyUserName={legacyUserName}
          tagMap={tagMap}
          onToggleTask={onToggleTask}
          onOpenTask={(id) => setTaskModal({ kind: "edit", taskId: id })}
          onOpenCreateTask={(status) =>
            setTaskModal({ kind: "create", status })
          }
        />
      ) : (
        <ProjectTaskBoard
          tasks={list}
          tagMap={tagMap}
          onToggleTask={onToggleTask}
          onOpenTask={(id) => setTaskModal({ kind: "edit", taskId: id })}
          onOpenCreateTask={(status) =>
            setTaskModal({ kind: "create", status })
          }
        />
      )}
    </div>
  );
}
