import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  dateInputValueToTimestamp,
  datetimeLocalToTimestamp,
  timestampToDatetimeLocal,
} from "@/lib/dates";
import { cn } from "@/lib/cn";
import { TASK_STATUS_LABEL, type TaskStatus } from "@/lib/task-status";
import {
  normalizeSubtasksForSave,
  type TaskSubtaskForm,
} from "@/lib/task-form";
import { TaskSubtasksField } from "@/components/tasks/TaskSubtasksField";
import type { Doc, Id } from "@cvx/_generated/dataModel";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

type Kind = "task" | "note" | "event";

type TaskFormState = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: Doc<"tasks">["priority"];
  dueDate: string;
  projectId: string;
  assigneeMemberId: string;
  labelIds: string[];
  subtasks: TaskSubtaskForm[];
  schedStart: string;
  schedEnd: string;
};

type NoteFormState = {
  title: string;
  body: string;
  projectId: string;
  folderId: string;
};

type EventFormState = {
  title: string;
  description: string;
  startLocal: string;
  endLocal: string;
  projectId: string;
};

function defaultTaskForm(): TaskFormState {
  return {
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    dueDate: "",
    projectId: "",
    assigneeMemberId: "",
    labelIds: [],
    subtasks: [],
    schedStart: "",
    schedEnd: "",
  };
}

function defaultNoteForm(): NoteFormState {
  return {
    title: "",
    body: "",
    projectId: "",
    folderId: "",
  };
}

function defaultEventForm(): EventFormState {
  const now = Date.now();
  return {
    title: "",
    description: "",
    startLocal: timestampToDatetimeLocal(now),
    endLocal: timestampToDatetimeLocal(now + 60 * 60 * 1000),
    projectId: "",
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function QuickAddModal({ open, onClose }: Props) {
  const { workspaceId } = useWorkspace();
  const createTask = useMutation(api.tasks.create);
  const createNote = useMutation(api.notes.create);
  const createEvent = useMutation(api.events.create);

  const tags = useQuery(
    api.tags.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const projects = useQuery(
    api.projects.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const folders = useQuery(
    api.folders.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const workspaceMembers = useQuery(
    api.workspaceMembers.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );

  const [kind, setKind] = useState<Kind>("task");
  const [taskForm, setTaskForm] = useState<TaskFormState>(defaultTaskForm);
  const [noteForm, setNoteForm] = useState<NoteFormState>(defaultNoteForm);
  const [eventForm, setEventForm] = useState<EventFormState>(defaultEventForm);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sortedProjects = useMemo(() => {
    const list = projects ?? [];
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [projects]);

  const sortedFolders = useMemo(() => {
    const list = folders ?? [];
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [folders]);

  const sortedMembers = useMemo(() => {
    const list = workspaceMembers ?? [];
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [workspaceMembers]);

  useEffect(() => {
    if (!open) return;
    setKind("task");
    setTaskForm(defaultTaskForm());
    setNoteForm(defaultNoteForm());
    setEventForm(defaultEventForm());
    setSubmitError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggleTaskTag(id: string) {
    setTaskForm((f) => ({
      ...f,
      labelIds: f.labelIds.includes(id)
        ? f.labelIds.filter((x) => x !== id)
        : [...f.labelIds, id],
    }));
  }

  async function submit() {
    if (!workspaceId) return;
    setSubmitError(null);

    if (kind === "task") {
      if (!taskForm.title.trim()) return;
      const schedS = taskForm.schedStart.trim();
      const schedE = taskForm.schedEnd.trim();
      if ((schedS || schedE) && !(schedS && schedE)) {
        setSubmitError(
          "For an agenda time block, set both start and end, or leave both empty.",
        );
        return;
      }
      let scheduledStart: number | undefined;
      let scheduledEnd: number | undefined;
      if (schedS && schedE) {
        const a = datetimeLocalToTimestamp(schedS);
        const b = datetimeLocalToTimestamp(schedE);
        if (Number.isNaN(a) || Number.isNaN(b) || b <= a) {
          setSubmitError("Invalid agenda start/end time.");
          return;
        }
        scheduledStart = a;
        scheduledEnd = b;
      }
      const subtasks = normalizeSubtasksForSave(taskForm.subtasks);
      setBusy(true);
      try {
        await createTask({
          workspaceId,
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || undefined,
          status: taskForm.status,
          priority: taskForm.priority,
          dueDate: dateInputValueToTimestamp(taskForm.dueDate),
          scheduledStart,
          scheduledEnd,
          projectId: taskForm.projectId
            ? (taskForm.projectId as Id<"projects">)
            : undefined,
          assigneeMemberId: taskForm.assigneeMemberId
            ? (taskForm.assigneeMemberId as Id<"workspaceMembers">)
            : undefined,
          labelIds: taskForm.labelIds.map((id) => id as Id<"tags">),
          ...(subtasks ? { subtasks } : {}),
        });
        onClose();
      } finally {
        setBusy(false);
      }
      return;
    }

    if (kind === "note") {
      if (!noteForm.title.trim()) return;
      setBusy(true);
      try {
        await createNote({
          workspaceId,
          title: noteForm.title.trim(),
          body: noteForm.body.trim() || " ",
          projectId: noteForm.projectId
            ? (noteForm.projectId as Id<"projects">)
            : undefined,
          folderId: noteForm.folderId
            ? (noteForm.folderId as Id<"folders">)
            : undefined,
        });
        onClose();
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!eventForm.title.trim()) return;
    const startTime = datetimeLocalToTimestamp(eventForm.startLocal);
    const endTime = datetimeLocalToTimestamp(eventForm.endLocal);
    if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
      setSubmitError("Invalid date or time.");
      return;
    }
    if (endTime <= startTime) {
      setSubmitError("End must be after start.");
      return;
    }
    setBusy(true);
    try {
      await createEvent({
        workspaceId,
        title: eventForm.title.trim(),
        description: eventForm.description.trim() || undefined,
        startTime,
        endTime,
        projectId: eventForm.projectId
          ? (eventForm.projectId as Id<"projects">)
          : undefined,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    kind === "task"
      ? Boolean(taskForm.title.trim())
      : kind === "note"
        ? Boolean(noteForm.title.trim())
        : Boolean(eventForm.title.trim()) &&
          (() => {
            const s = datetimeLocalToTimestamp(eventForm.startLocal);
            const e = datetimeLocalToTimestamp(eventForm.endLocal);
            return (
              !Number.isNaN(s) &&
              !Number.isNaN(e) &&
              e > s
            );
          })();

  const kindLabels: Record<Kind, string> = {
    task: "Task",
    note: "Note",
    event: "Event",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/20 p-4 pt-[8vh] backdrop-blur-sm">
      <div className="flex max-h-[min(90vh,760px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl">
        <div className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Quick add</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Create a task, note, or agenda event in one place.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["task", "note", "event"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  kind === k
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {kindLabels[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {submitError ? (
            <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {submitError}
            </p>
          ) : null}

          {kind === "task" ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Title <span className="text-rose-600">*</span>
                </label>
                <input
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="What needs to be done?"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Description
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                  className={cn(inputClass, "resize-none")}
                  placeholder="Optional details"
                />
              </div>
              <TaskSubtasksField
                subtasks={taskForm.subtasks}
                onChange={(subtasks) =>
                  setTaskForm((f) => ({ ...f, subtasks }))
                }
                inputClass={inputClass}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Status
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(e) =>
                      setTaskForm((f) => ({
                        ...f,
                        status: e.target.value as TaskStatus,
                      }))
                    }
                    className={inputClass}
                  >
                    {(
                      Object.keys(TASK_STATUS_LABEL) as TaskStatus[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {TASK_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Priority
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) =>
                      setTaskForm((f) => ({
                        ...f,
                        priority: e.target.value as Doc<"tasks">["priority"],
                      }))
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
                  <label className="text-xs font-medium text-slate-600">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) =>
                      setTaskForm((f) => ({ ...f, dueDate: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Assignee
                  </label>
                  <select
                    value={taskForm.assigneeMemberId}
                    onChange={(e) =>
                      setTaskForm((f) => ({
                        ...f,
                        assigneeMemberId: e.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Unassigned</option>
                    {sortedMembers.map((m) => (
                      <option key={String(m._id)} value={String(m._id)}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    <Link
                      to="/settings"
                      className="font-medium text-accent hover:text-accent-strong hover:underline"
                      onClick={onClose}
                    >
                      Manage assignees
                    </Link>
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Project
                </label>
                <select
                  value={taskForm.projectId}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, projectId: e.target.value }))
                  }
                  className={inputClass}
                >
                  <option value="">No project</option>
                  {sortedProjects.map((p) => (
                    <option key={String(p._id)} value={String(p._id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-600">
                  Agenda time block (optional)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Shows on your calendar when both start and end are set.
                </p>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500">Start</label>
                    <input
                      type="datetime-local"
                      value={taskForm.schedStart}
                      onChange={(e) =>
                        setTaskForm((f) => ({
                          ...f,
                          schedStart: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">End</label>
                    <input
                      type="datetime-local"
                      value={taskForm.schedEnd}
                      onChange={(e) =>
                        setTaskForm((f) => ({ ...f, schedEnd: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
              {tags && tags.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-slate-600">Tags</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <label
                        key={String(t._id)}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                          taskForm.labelIds.includes(String(t._id))
                            ? "border-accent-border bg-accent-soft text-accent-ink"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={taskForm.labelIds.includes(String(t._id))}
                          onChange={() => toggleTaskTag(String(t._id))}
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {kind === "note" ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Title <span className="text-rose-600">*</span>
                </label>
                <input
                  value={noteForm.title}
                  onChange={(e) =>
                    setNoteForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Note title"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Body</label>
                <textarea
                  value={noteForm.body}
                  onChange={(e) =>
                    setNoteForm((f) => ({ ...f, body: e.target.value }))
                  }
                  rows={6}
                  className={cn(inputClass, "resize-none")}
                  placeholder="Write your note…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Project
                  </label>
                  <select
                    value={noteForm.projectId}
                    onChange={(e) =>
                      setNoteForm((f) => ({ ...f, projectId: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="">None</option>
                    {sortedProjects.map((p) => (
                      <option key={String(p._id)} value={String(p._id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Folder
                  </label>
                  <select
                    value={noteForm.folderId}
                    onChange={(e) =>
                      setNoteForm((f) => ({ ...f, folderId: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="">None</option>
                    {sortedFolders.map((f) => (
                      <option key={String(f._id)} value={String(f._id)}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          {kind === "event" ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Title <span className="text-rose-600">*</span>
                </label>
                <input
                  value={eventForm.title}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Meeting, focus block…"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Description
                </label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) =>
                    setEventForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  className={cn(inputClass, "resize-none")}
                  placeholder="Optional details"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Start <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={eventForm.startLocal}
                    onChange={(e) =>
                      setEventForm((f) => ({
                        ...f,
                        startLocal: e.target.value,
                      }))
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    End <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={eventForm.endLocal}
                    onChange={(e) =>
                      setEventForm((f) => ({ ...f, endLocal: e.target.value }))
                    }
                    className={inputClass}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Project
                </label>
                <select
                  value={eventForm.projectId}
                  onChange={(e) =>
                    setEventForm((f) => ({ ...f, projectId: e.target.value }))
                  }
                  className={inputClass}
                >
                  <option value="">None</option>
                  {sortedProjects.map((p) => (
                    <option key={String(p._id)} value={String(p._id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !canSubmit}
              onClick={() => void submit()}
              className="rounded-xl bg-accent-solid px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-solid-hover disabled:opacity-40"
            >
              {kind === "event" ? "Add to agenda" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
