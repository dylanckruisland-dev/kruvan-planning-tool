import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery } from "convex/react";
import { type ReactNode, useMemo, useState } from "react";
import { api } from "@cvx/_generated/api";
import { MentionInlineText } from "@/components/mentions/MentionInlineText";
import { TaskBoardCard } from "@/components/tasks/TaskBoardCard";
import { TaskAssignee } from "@/components/tasks/TaskAssignee";
import { taskAssigneeLabel } from "@/lib/task-assignee";
import {
  TASK_STATUS_DOT_CLASS,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  type TaskStatus,
} from "@/lib/task-status";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { ListChecks, Plus } from "lucide-react";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatShortDate } from "@/lib/dates";
import { taskDueDateTextClass } from "@/lib/due-urgency";
import { taskSubtaskProgress } from "@/lib/task-form";
import { runTaskDragEnd, taskColumnDroppableId } from "@/lib/task-board-reorder";
import {
  type TaskDueSortDir,
  sortTasksByDueDate,
} from "@/lib/task-due-sort";

type Task = Doc<"tasks">;

function BoardCardDragPreview({
  task,
  labels,
  assigneeName,
  taskById,
}: {
  task: Task;
  labels: string[];
  assigneeName?: string;
  taskById?: Map<string, Task>;
}) {
  const done = task.status === "done";
  const subProgress = taskSubtaskProgress(task);
  const blocker =
    task.blockedByTaskId && taskById?.get(String(task.blockedByTaskId));
  const blocked =
    Boolean(blocker) &&
    blocker!.status !== "done" &&
    blocker!.status !== "cancelled";
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-xl ring-2 ring-accent-dnd">
      <div className="flex gap-2">
        <div className="mt-0.5 shrink-0 text-slate-300">
          <span className="inline-block h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
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
              <span className="chip-accent-subtasks inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset">
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
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({
  status,
  count,
  children,
  onAdd,
}: {
  status: TaskStatus;
  count: number;
  children: ReactNode;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: taskColumnDroppableId(status) });

  return (
    <div className="flex min-w-[260px] max-w-[320px] flex-1 flex-col rounded-2xl border border-slate-200/80 bg-slate-50/80">
      <div className="flex items-center gap-2 border-b border-slate-200/60 px-3 py-2.5">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            TASK_STATUS_DOT_CLASS[status],
          )}
        />
        <span className="text-sm font-semibold text-slate-800">
          {TASK_STATUS_LABEL[status]}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200/80">
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 p-2 transition-colors duration-200",
          isOver && "bg-accent-tint ring-1 ring-inset ring-accent-soft-ring",
        )}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="m-2 flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-400 hover:bg-white hover:text-slate-700"
      >
        <Plus className="h-3.5 w-3.5" />
        New task
      </button>
    </div>
  );
}

type Props = {
  workspaceId: Id<"workspaces">;
  /** When set, drag/reorder merges project task order into the full workspace column. */
  projectId?: Id<"projects">;
  tasks: Task[];
  /** When set, tasks in each column are ordered by due date. */
  dueSort?: TaskDueSortDir;
  tagMap: Map<string, string>;
  memberName: Map<string, string>;
  legacyUserName: Map<string, string>;
  onToggleTask: (taskId: Id<"tasks">) => void;
  onOpenTask: (taskId: Id<"tasks">) => void;
  onOpenCreateTask: (status: TaskStatus) => void;
};

export function ProjectTaskBoard({
  workspaceId,
  projectId,
  tasks,
  dueSort,
  tagMap,
  memberName,
  legacyUserName,
  onToggleTask,
  onOpenTask,
  onOpenCreateTask,
}: Props) {
  const update = useMutation(api.tasks.update);
  const reorderColumn = useMutation(api.tasks.reorderTasksInColumn);

  const allWorkspaceTasks = useQuery(api.tasks.listByWorkspace, {
    workspaceId,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  const allTasks = allWorkspaceTasks ?? tasks;

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of allTasks) {
      m.set(String(t._id), t);
    }
    return m;
  }, [allTasks]);

  const byStatus = useMemo(() => {
    const m = new Map<TaskStatus, Task[]>();
    for (const s of TASK_STATUS_ORDER) {
      m.set(s, []);
    }
    for (const t of tasks) {
      const list = m.get(t.status);
      if (list) list.push(t);
    }
    for (const s of TASK_STATUS_ORDER) {
      const list = m.get(s);
      if (!list) continue;
      if (dueSort) {
        m.set(s, sortTasksByDueDate(list, dueSort));
      } else {
        list.sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            String(a._id).localeCompare(String(b._id)),
        );
      }
    }
    return m;
  }, [tasks, dueSort]);

  const activeTask = useMemo(
    () => (activeId ? tasks.find((t) => String(t._id) === activeId) : null),
    [activeId, tasks],
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    await runTaskDragEnd({
      event,
      allTasks,
      workspaceId,
      projectId,
      update: (args) => update(args),
      reorderColumn: (args) => reorderColumn(args),
    });
  }

  if (allWorkspaceTasks === undefined) {
    return (
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200/80" />
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TASK_STATUS_ORDER.map((status) => {
          const list = byStatus.get(status) ?? [];
          const sortableIds = list.map((t) => String(t._id));
          return (
            <DroppableColumn
              key={status}
              status={status}
              count={list.length}
              onAdd={() => onOpenCreateTask(status)}
            >
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                {list.map((t) => (
                  <TaskBoardCard
                    key={t._id}
                    task={t}
                    taskById={taskById}
                    labels={t.labelIds.map(
                      (id) => tagMap.get(String(id)) ?? "",
                    )}
                    assigneeName={taskAssigneeLabel(
                      t,
                      memberName,
                      legacyUserName,
                    )}
                    onToggle={() => onToggleTask(t._id)}
                    onOpen={() => onOpenTask(t._id)}
                  />
                ))}
              </SortableContext>
            </DroppableColumn>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
        {activeTask ? (
          <div className="max-w-[280px] rotate-1 scale-[1.02]">
            <BoardCardDragPreview
              task={activeTask}
              taskById={taskById}
              labels={activeTask.labelIds.map(
                (id) => tagMap.get(String(id)) ?? "",
              )}
              assigneeName={taskAssigneeLabel(
                activeTask,
                memberName,
                legacyUserName,
              )}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
