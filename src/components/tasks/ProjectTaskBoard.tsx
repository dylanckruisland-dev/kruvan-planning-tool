import {
  closestCorners,
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { type ReactNode } from "react";
import { api } from "@cvx/_generated/api";
import { TaskBoardCard } from "@/components/tasks/TaskBoardCard";
import {
  TASK_STATUS_DOT_CLASS,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  type TaskStatus,
} from "@/lib/task-status";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { Plus } from "lucide-react";

type Task = Doc<"tasks">;

function columnId(status: TaskStatus) {
  return `col-${status}`;
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
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });

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
          "flex min-h-[120px] flex-1 flex-col gap-2 p-2 transition-colors",
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
  tasks: Task[];
  tagMap: Map<string, string>;
  onToggleTask: (taskId: Id<"tasks">) => void;
  onOpenTask: (taskId: Id<"tasks">) => void;
  onOpenCreateTask: (status: TaskStatus) => void;
};

export function ProjectTaskBoard({
  tasks,
  tagMap,
  onToggleTask,
  onOpenTask,
  onOpenCreateTask,
}: Props) {
  const update = useMutation(api.tasks.update);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as Id<"tasks">;
    let targetStatus: TaskStatus | undefined;
    const overStr = String(over.id);
    if (overStr.startsWith("col-")) {
      targetStatus = overStr.slice(4) as TaskStatus;
    } else {
      const t = tasks.find((x) => String(x._id) === overStr);
      targetStatus = t?.status;
    }
    if (!targetStatus) return;
    const current = tasks.find((x) => String(x._id) === String(taskId));
    if (!current || current.status === targetStatus) return;
    await update({ taskId, status: targetStatus });
  }

  const byStatus = new Map<TaskStatus, Task[]>();
  for (const s of TASK_STATUS_ORDER) {
    byStatus.set(s, []);
  }
  for (const t of tasks) {
    const list = byStatus.get(t.status);
    if (list) list.push(t);
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      sensors={sensors}
      onDragEnd={(e) => void handleDragEnd(e)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TASK_STATUS_ORDER.map((status) => {
          const list = byStatus.get(status) ?? [];
          return (
            <DroppableColumn
              key={status}
              status={status}
              count={list.length}
              onAdd={() => onOpenCreateTask(status)}
            >
              {list.map((t) => (
                <TaskBoardCard
                  key={t._id}
                  task={t}
                  labels={t.labelIds.map((id) => tagMap.get(String(id)) ?? "")}
                  onToggle={() => onToggleTask(t._id)}
                  onOpen={() => onOpenTask(t._id)}
                />
              ))}
            </DroppableColumn>
          );
        })}
      </div>
    </DndContext>
  );
}
