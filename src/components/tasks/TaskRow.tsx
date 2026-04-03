import { CheckCircle2, Circle, ListChecks, Trash2 } from "lucide-react";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatShortDate } from "@/lib/dates";
import { taskDueDateTextClass } from "@/lib/due-urgency";
import { MentionInlineText } from "@/components/mentions/MentionInlineText";
import { cn } from "@/lib/cn";
import { taskSubtaskProgress } from "@/lib/task-form";
import { TaskAssignee } from "@/components/tasks/TaskAssignee";
import type { Doc } from "@cvx/_generated/dataModel";

type Task = Doc<"tasks">;

const overviewDescriptionClass =
  "mt-0.5 min-w-0 max-w-full truncate text-xs text-slate-500";

function blockedState(task: Task, taskById?: Map<string, Task>) {
  const blocker =
    task.blockedByTaskId && taskById?.get(String(task.blockedByTaskId));
  const blocked =
    Boolean(blocker) &&
    blocker!.status !== "done" &&
    blocker!.status !== "cancelled";
  return { blocked, blocker };
}

type Props = {
  task: Task;
  projectName?: string;
  assigneeName?: string;
  labels: string[];
  /** Lookup for “blocked by” resolution (workspace tasks). */
  taskById?: Map<string, Task>;
  /** Completes / toggles done state (checkbox only when `onOpen` is set). */
  onToggle?: () => void;
  /** Opens task detail / edit. When set, title and metadata open editor; checkbox uses `onToggle`. */
  onOpen?: () => void;
  /** Delete action (e.g. confirm dialog). Does not open the task. */
  onDelete?: () => void;
  className?: string;
};

export function TaskRow({
  task,
  projectName,
  assigneeName,
  labels,
  taskById,
  onToggle,
  onOpen,
  onDelete,
  className,
}: Props) {
  const done = task.status === "done";
  const split = Boolean(onOpen && onToggle);
  const subProgress = taskSubtaskProgress(task);
  const { blocked } = blockedState(task, taskById);

  if (split) {
    return (
      <div
        className={cn(
          "flex items-stretch overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md",
          done && "opacity-70",
          className,
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className="flex shrink-0 items-center justify-center border-r border-slate-100 px-4 py-3 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          aria-label={done ? "Mark incomplete" : "Mark complete"}
        >
          {done ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-slate-300" />
          )}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0 flex-1 overflow-hidden sm:max-w-[min(100%,28rem)]">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "min-w-0 text-sm font-medium text-slate-900",
                  done && "line-through text-slate-500",
                )}
              >
                <MentionInlineText text={task.title} />
              </p>
              {subProgress ? (
                <span
                  className="chip-accent-subtasks inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
                  title="Subtasks"
                >
                  <ListChecks className="h-3 w-3" aria-hidden />
                  {subProgress.done}/{subProgress.total}
                </span>
              ) : null}
              {blocked ? (
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200/80">
                  Blocked
                </span>
              ) : null}
              {task.recurrence ? (
                <span
                  className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80"
                  title="Repeating task"
                >
                  Repeats
                </span>
              ) : null}
            </div>
            {task.description ? (
              <p className={overviewDescriptionClass} title={task.description}>
                <MentionInlineText text={task.description} />
              </p>
            ) : null}
          </div>
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {projectName ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {projectName}
              </span>
            ) : null}
            {labels.map((l) => (
              <span
                key={l}
                className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink"
              >
                {l}
              </span>
            ))}
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <span
              className={cn(
                "text-xs",
                task.dueDate ? taskDueDateTextClass(task) : "text-slate-500",
              )}
            >
              {task.dueDate ? formatShortDate(task.dueDate) : "No date"}
            </span>
            {assigneeName ? (
              <TaskAssignee name={assigneeName} />
            ) : (
              <span className="text-xs text-slate-400">Unassigned</span>
            )}
          </div>
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex shrink-0 items-center justify-center border-l border-slate-100 px-3 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            aria-label="Delete task"
          >
            <Trash2 className="mx-auto h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md",
        done && "opacity-70",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex shrink-0 items-center gap-3 text-left"
          aria-label={done ? "Mark incomplete" : "Mark complete"}
        >
          {done ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-slate-300" />
          )}
          <div className="min-w-0 flex-1 overflow-hidden sm:max-w-[min(100%,28rem)]">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "min-w-0 text-sm font-medium text-slate-900",
                  done && "line-through text-slate-500",
                )}
              >
                <MentionInlineText text={task.title} />
              </p>
              {subProgress ? (
                <span
                  className="chip-accent-subtasks inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
                  title="Subtasks"
                >
                  <ListChecks className="h-3 w-3" aria-hidden />
                  {subProgress.done}/{subProgress.total}
                </span>
              ) : null}
              {blocked ? (
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200/80">
                  Blocked
                </span>
              ) : null}
              {task.recurrence ? (
                <span
                  className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80"
                  title="Repeating task"
                >
                  Repeats
                </span>
              ) : null}
            </div>
            {task.description ? (
              <p className={overviewDescriptionClass} title={task.description}>
                <MentionInlineText text={task.description} />
              </p>
            ) : null}
          </div>
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
          {projectName ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {projectName}
            </span>
          ) : null}
          {labels.map((l) => (
            <span
              key={l}
              className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink"
            >
              {l}
            </span>
          ))}
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          <span
            className={cn(
              "text-xs",
              task.dueDate ? taskDueDateTextClass(task) : "text-slate-500",
            )}
          >
            {task.dueDate ? formatShortDate(task.dueDate) : "No date"}
          </span>
          {assigneeName ? (
            <TaskAssignee name={assigneeName} />
          ) : (
            <span className="text-xs text-slate-400">Unassigned</span>
          )}
        </div>
      </div>
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex shrink-0 items-center justify-center border-l border-slate-100 px-3 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          aria-label="Delete task"
        >
          <Trash2 className="mx-auto h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
