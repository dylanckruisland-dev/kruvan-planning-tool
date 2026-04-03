import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Circle, GripVertical, ListChecks } from "lucide-react";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MentionInlineText } from "@/components/mentions/MentionInlineText";
import { formatShortDate } from "@/lib/dates";
import { taskDueDateTextClass } from "@/lib/due-urgency";
import { cn } from "@/lib/cn";
import { taskSubtaskProgress } from "@/lib/task-form";
import type { Doc } from "@cvx/_generated/dataModel";
import { TaskAssignee } from "@/components/tasks/TaskAssignee";

type Task = Doc<"tasks">;

function blockedState(task: Task, taskById?: Map<string, Task>) {
  const blocker =
    task.blockedByTaskId && taskById?.get(String(task.blockedByTaskId));
  const blocked =
    Boolean(blocker) &&
    blocker!.status !== "done" &&
    blocker!.status !== "cancelled";
  return { blocked };
}

type Props = {
  task: Task;
  labels: string[];
  assigneeName?: string;
  taskById?: Map<string, Task>;
  onToggle?: () => void;
  onOpen?: () => void;
};

export function TaskBoardCard({
  task,
  labels,
  assigneeName,
  taskById,
  onToggle,
  onOpen,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: String(task._id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const done = task.status === "done";
  const split = Boolean(onOpen && onToggle);
  const subProgress = taskSubtaskProgress(task);
  const { blocked } = blockedState(task, taskById);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100/80 transition-[box-shadow,transform,opacity]",
        isDragging && "z-20 cursor-grabbing opacity-80 shadow-lg ring-2 ring-accent-dnd",
        !isDragging && "hover:border-slate-300",
      )}
    >
      <div className="flex gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          aria-label="Drag task"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          {split ? (
            <button
              type="button"
              onClick={onOpen}
              className="w-full rounded-lg text-left transition hover:bg-slate-50/80"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "min-w-0 flex-1 text-sm font-medium text-slate-900",
                    done && "text-slate-500 line-through",
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
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80">
                    Repeats
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                <span
                  className={cn(
                    "text-[11px]",
                    task.dueDate ? taskDueDateTextClass(task) : "text-slate-500",
                  )}
                >
                  {task.dueDate ? formatShortDate(task.dueDate) : "—"}
                </span>
              </div>
              {labels.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {labels.map((l) => (
                    <span
                      key={l}
                      className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              ) : null}
              {assigneeName ? (
                <div className="mt-2 flex justify-end">
                  <TaskAssignee name={assigneeName} />
                </div>
              ) : null}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onToggle}
                className="w-full text-left"
                aria-label={done ? "Mark incomplete" : "Mark complete"}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "min-w-0 flex-1 text-sm font-medium text-slate-900",
                      done && "text-slate-500 line-through",
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
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80">
                      Repeats
                    </span>
                  ) : null}
                </div>
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                <span
                  className={cn(
                    "text-[11px]",
                    task.dueDate ? taskDueDateTextClass(task) : "text-slate-500",
                  )}
                >
                  {task.dueDate ? formatShortDate(task.dueDate) : "—"}
                </span>
              </div>
              {labels.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {labels.map((l) => (
                    <span
                      key={l}
                      className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              ) : null}
              {assigneeName ? (
                <div className="mt-2 flex justify-end">
                  <TaskAssignee name={assigneeName} />
                </div>
              ) : null}
            </>
          )}
        </div>
        {split ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            className="shrink-0 self-start rounded-lg p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            aria-label={done ? "Mark incomplete" : "Mark complete"}
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Circle className="h-4 w-4 text-slate-300" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
