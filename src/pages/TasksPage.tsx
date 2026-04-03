import { useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { ProjectTaskBoard } from "@/components/tasks/ProjectTaskBoard";
import { ProjectTaskListByStatus } from "@/components/tasks/ProjectTaskListByStatus";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskDueSortToggle } from "@/components/ui/TaskDueSortToggle";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useToast } from "@/contexts/ToastContext";
import { useTabTitle } from "@/hooks/useTabTitle";
import { useWorkspace } from "@/hooks/useWorkspace";
import { tasksPageSearch } from "@/lib/router-search-defaults";
import {
  type TaskDueSortDir,
  parseTaskDueSort,
} from "@/lib/task-due-sort";
import type { TaskStatus } from "@/lib/task-status";
import { cn } from "@/lib/cn";
import type { Id } from "@cvx/_generated/dataModel";
import { CheckSquare, Columns3, LayoutList } from "lucide-react";

type TaskModalState =
  | { kind: "edit"; taskId: Id<"tasks"> }
  | { kind: "create"; status: TaskStatus };

export function TasksPage() {
  const { toast } = useToast();
  const { workspaceId, workspace } = useWorkspace();
  const navigate = useNavigate({ from: "/tasks" });
  const {
    task: taskFromUrl,
    taskView: taskViewRaw,
    dueSort: dueSortFromUrl,
  } = useSearch({
    from: "/tasks",
  });
  const dueSortParsed = parseTaskDueSort(dueSortFromUrl);
  const taskView =
    taskViewRaw === "board" || taskViewRaw === "list"
      ? taskViewRaw
      : workspace?.defaultTaskView === "board"
        ? "board"
        : "list";
  const [taskModal, setTaskModal] = useState<TaskModalState | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<Id<"tasks"> | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const tasks = useQuery(
    api.tasks.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const projects = useQuery(
    api.projects.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const allUsers = useQuery(
    api.dashboard.getOverview,
    workspaceId ? { workspaceId } : "skip",
  );
  const toggle = useMutation(api.tasks.toggleComplete);
  const removeTask = useMutation(api.tasks.remove);

  const projectName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects ?? []) {
      m.set(String(p._id), p.name);
    }
    return m;
  }, [projects]);

  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of allUsers?.workspaceMembers ?? []) {
      m.set(String(mem._id), mem.name);
    }
    return m;
  }, [allUsers]);

  const legacyUserName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of allUsers?.users ?? []) {
      m.set(String(u._id), u.name ?? "");
    }
    return m;
  }, [allUsers]);

  const tagMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of allUsers?.tags ?? []) {
      m.set(String(t._id), t.name);
    }
    return m;
  }, [allUsers]);

  const list = useMemo(() => tasks ?? [], [tasks]);

  const tasksTabTitle = useMemo(() => {
    if (!taskFromUrl) return "Tasks";
    const row = list.find((t) => String(t._id) === taskFromUrl);
    if (row?.title?.trim()) return row.title;
    return "Task";
  }, [taskFromUrl, list]);
  useTabTitle(tasksTabTitle);

  function setDueSort(value: TaskDueSortDir | undefined) {
    void navigate({
      search: (prev) => ({
        ...prev,
        dueSort: value,
      }),
    });
  }

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

  const modalProjectName = useMemo(() => {
    if (!taskModal || taskModal.kind === "create") return "Workspace";
    const t = editingTask;
    if (!t) return "Workspace";
    if (!t.projectId) return "Workspace";
    return projectName.get(String(t.projectId)) ?? "Project";
  }, [taskModal, editingTask, projectName]);

  if (!workspaceId || tasks === undefined) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />;
  }

  function onToggleTask(taskId: Id<"tasks">) {
    void toggle({ taskId });
  }

  async function confirmDeleteTask() {
    if (!deleteTaskId) return;
    setDeleteBusy(true);
    try {
      await removeTask({ taskId: deleteTaskId });
      toast("Task deleted");
      if (taskModal?.kind === "edit" && taskModal.taskId === deleteTaskId) {
        setTaskModal(null);
      }
      setDeleteTaskId(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const taskSearch = taskFromUrl ?? undefined;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteTaskId !== null}
        onClose={() => setDeleteTaskId(null)}
        title="Delete task?"
        description="This task will be permanently removed."
        confirmLabel="Delete task"
        variant="danger"
        busy={deleteBusy}
        onConfirm={confirmDeleteTask}
      />
      <TaskEditModal
        open={modalOpen}
        onClose={() => setTaskModal(null)}
        task={taskModal?.kind === "create" ? null : editingTask}
        workspaceId={workspaceId}
        projectId={
          taskModal?.kind === "create"
            ? undefined
            : editingTask?.projectId ?? undefined
        }
        projectName={modalProjectName}
        workspaceMembers={allUsers?.workspaceMembers ?? []}
        tags={allUsers?.tags ?? []}
        createInitialStatus={
          taskModal?.kind === "create" ? taskModal.status : undefined
        }
      />

      <SectionHeader
        title="Tasks"
        description="By status or board — all tasks in your workspace."
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <TaskDueSortToggle
            value={dueSortParsed}
            onChange={setDueSort}
            className="w-full min-w-0 sm:w-auto"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="inline-flex rounded-xl border border-slate-200/90 bg-slate-50/80 p-1 shadow-sm">
              <Link
                to="/tasks"
                search={{
                  ...tasksPageSearch,
                  task: taskSearch,
                  taskView: "list",
                  dueSort: dueSortParsed,
                }}
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
                to="/tasks"
                search={{
                  ...tasksPageSearch,
                  task: taskSearch,
                  taskView: "board",
                  dueSort: dueSortParsed,
                }}
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
              className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Add task
            </button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks yet"
            description="Add a task here, use Quick add (⌘N), or create tasks from a project."
            action={
              <button
                type="button"
                onClick={() =>
                  setTaskModal({ kind: "create", status: "todo" })
                }
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Add task
              </button>
            }
          />
        ) : taskView === "board" ? (
          <ProjectTaskBoard
            workspaceId={workspaceId}
            tasks={list}
            dueSort={dueSortParsed}
            tagMap={tagMap}
            memberName={memberName}
            legacyUserName={legacyUserName}
            onToggleTask={onToggleTask}
            onOpenTask={(id) => setTaskModal({ kind: "edit", taskId: id })}
            onOpenCreateTask={(status) =>
              setTaskModal({ kind: "create", status })
            }
          />
        ) : (
          <ProjectTaskListByStatus
            workspaceId={workspaceId}
            tasks={list}
            dueSort={dueSortParsed}
            memberName={memberName}
            legacyUserName={legacyUserName}
            tagMap={tagMap}
            projectNameById={projectName}
            onToggleTask={onToggleTask}
            onOpenTask={(id) => setTaskModal({ kind: "edit", taskId: id })}
            onOpenCreateTask={(status) =>
              setTaskModal({ kind: "create", status })
            }
            onDeleteTask={(id) => setDeleteTaskId(id)}
          />
        )}
      </div>
    </div>
  );
}
