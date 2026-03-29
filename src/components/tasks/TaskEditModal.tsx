import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import {
  emptyTaskFormValues,
  normalizeSubtasksForSave,
  taskToFormValues,
  type TaskFormValues,
} from "@/lib/task-form";
import { TaskSubtasksField } from "@/components/tasks/TaskSubtasksField";
import type { TaskStatus } from "@/lib/task-status";
import { dateInputValueToTimestamp } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@cvx/_generated/dataModel";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Existing task to edit; `null` opens the create flow. */
  task: Doc<"tasks"> | null;
  workspaceId: Id<"workspaces">;
  /** Omit for workspace-level tasks (global Tasks page). */
  projectId?: Id<"projects">;
  projectName: string;
  workspaceMembers: Doc<"workspaceMembers">[];
  tags: Doc<"tags">[];
  /** Initial status when creating (list/board column). Ignored when `task` is set. */
  createInitialStatus?: TaskStatus;
};

export function TaskEditModal({
  open,
  onClose,
  task,
  workspaceId,
  projectId,
  projectName,
  workspaceMembers,
  tags,
  createInitialStatus = "todo",
}: Props) {
  const { toast } = useToast();
  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<TaskFormValues | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setValues(null);
      return;
    }
    if (task) {
      setValues(taskToFormValues(task));
    } else {
      setValues(emptyTaskFormValues(createInitialStatus));
    }
  }, [open, task, createInitialStatus]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleteOpen) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, deleteOpen]);

  useEffect(() => {
    if (!open) setDeleteOpen(false);
  }, [open]);

  if (!open || !values) return null;

  const isCreate = task === null;

  async function handleDeleteTask() {
    if (!task) return;
    setDeleteBusy(true);
    try {
      await removeTask({ taskId: task._id });
      toast("Task deleted");
      setDeleteOpen(false);
      onClose();
    } finally {
      setDeleteBusy(false);
    }
  }

  function toggleTag(id: string) {
    setValues((v) => {
      if (!v) return v;
      return {
        ...v,
        labelIds: v.labelIds.includes(id)
          ? v.labelIds.filter((x: string) => x !== id)
          : [...v.labelIds, id],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values) return;
    if (!values.title.trim()) return;
    setBusy(true);
    try {
      const subtasks = normalizeSubtasksForSave(values.subtasks);
      if (isCreate) {
        await createTask({
          workspaceId,
          ...(projectId ? { projectId } : {}),
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          status: values.status,
          priority: values.priority,
          dueDate: values.dueDate
            ? dateInputValueToTimestamp(values.dueDate)
            : undefined,
          assigneeMemberId: values.assigneeMemberId
            ? (values.assigneeMemberId as Id<"workspaceMembers">)
            : undefined,
          labelIds: values.labelIds.map((id) => id as Id<"tags">),
          ...(subtasks ? { subtasks } : {}),
        });
      } else {
        await updateTask({
          taskId: task._id,
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          status: values.status,
          priority: values.priority,
          dueDate: values.dueDate
            ? dateInputValueToTimestamp(values.dueDate)
            : null,
          assigneeMemberId: values.assigneeMemberId
            ? (values.assigneeMemberId as Id<"workspaceMembers">)
            : null,
          labelIds: values.labelIds.map((id) => id as Id<"tags">),
          subtasks: subtasks ?? [],
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <ConfirmDialog
      open={deleteOpen}
      onClose={() => setDeleteOpen(false)}
      title="Delete task?"
      description="This task will be permanently removed."
      confirmLabel="Delete task"
      variant="danger"
      busy={deleteBusy}
      onConfirm={handleDeleteTask}
    />
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/25 p-4 pt-[8vh] backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="task-edit-title"
            className="text-lg font-semibold text-slate-900"
          >
            {isCreate ? "New task" : "Edit task"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Project: <span className="font-medium text-slate-700">{projectName}</span>
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div>
            <label htmlFor="te-title" className="text-xs font-medium text-slate-600">
              Title <span className="text-rose-600">*</span>
            </label>
            <input
              id="te-title"
              value={values.title}
              onChange={(e) =>
                setValues((v) => (v ? { ...v, title: e.target.value } : v))
              }
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor="te-desc" className="text-xs font-medium text-slate-600">
              Description
            </label>
            <textarea
              id="te-desc"
              value={values.description}
              onChange={(e) =>
                setValues((v) =>
                  v ? { ...v, description: e.target.value } : v,
                )
              }
              rows={3}
              className={cn(inputClass, "resize-none")}
            />
          </div>

          <TaskSubtasksField
            subtasks={values.subtasks}
            onChange={(subtasks) =>
              setValues((v) => (v ? { ...v, subtasks } : v))
            }
            inputClass={inputClass}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="te-status" className="text-xs font-medium text-slate-600">
                Status
              </label>
              <select
                id="te-status"
                value={values.status}
                onChange={(e) =>
                  setValues((v) =>
                    v
                      ? {
                          ...v,
                          status: e.target.value as TaskFormValues["status"],
                        }
                      : v,
                  )
                }
                className={inputClass}
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label htmlFor="te-priority" className="text-xs font-medium text-slate-600">
                Priority
              </label>
              <select
                id="te-priority"
                value={values.priority}
                onChange={(e) =>
                  setValues((v) =>
                    v
                      ? {
                          ...v,
                          priority: e.target.value as TaskFormValues["priority"],
                        }
                      : v,
                  )
                }
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="te-due" className="text-xs font-medium text-slate-600">
                Due date
              </label>
              <input
                id="te-due"
                type="date"
                value={values.dueDate}
                onChange={(e) =>
                  setValues((v) =>
                    v ? { ...v, dueDate: e.target.value } : v,
                  )
                }
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="te-assignee" className="text-xs font-medium text-slate-600">
                Assignee
              </label>
              <select
                id="te-assignee"
                value={values.assigneeMemberId}
                onChange={(e) =>
                  setValues((v) =>
                    v ? { ...v, assigneeMemberId: e.target.value } : v,
                  )
                }
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {workspaceMembers.map((m) => (
                  <option key={String(m._id)} value={String(m._id)}>
                    {m.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">
                <Link
                  to="/settings"
                  className="font-medium text-accent hover:text-accent-strong hover:underline"
                  onClick={onClose}
                >
                  Manage assignees
                </Link>{" "}
                in Settings to add or remove people.
              </p>
            </div>
          </div>

          {tags.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-slate-600">Tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <label
                    key={String(t._id)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      values.labelIds.includes(String(t._id))
                        ? "border-accent-border bg-accent-soft text-accent-ink"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={values.labelIds.includes(String(t._id))}
                      onChange={() => toggleTag(String(t._id))}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            {!isCreate ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="rounded-xl px-2 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
              >
                Delete task
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !values.title.trim()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
              >
                {isCreate ? "Create task" : "Save task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
