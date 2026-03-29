import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { useState, type ReactNode } from "react";
import { api } from "@cvx/_generated/api";
import { TaskRow } from "@/components/tasks/TaskRow";
import {
  TASK_STATUS_DOT_CLASS,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  type TaskStatus,
} from "@/lib/task-status";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { ChevronRight, GripVertical, Plus } from "lucide-react";

type Task = Doc<"tasks">;

function columnId(status: TaskStatus) {
  return `col-${status}`;
}

type Props = {
  tasks: Task[];
  memberName: Map<string, string>;
  legacyUserName: Map<string, string>;
  tagMap: Map<string, string>;
  onToggleTask: (taskId: Id<"tasks">) => void;
  onOpenTask: (taskId: Id<"tasks">) => void;
  onOpenCreateTask: (status: TaskStatus) => void;
  /** When set (e.g. workspace tasks list), show project name on each row. */
  projectNameById?: Map<string, string>;
  onDeleteTask?: (taskId: Id<"tasks">) => void;
};

function DroppableStatusSection({
  status,
  children,
}: {
  status: TaskStatus;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/80 shadow-sm transition",
        isOver && "ring-2 ring-accent-dnd",
      )}
    >
      {children}
    </section>
  );
}

function DraggableTaskRow({
  taskId,
  children,
}: {
  taskId: Id<"tasks">;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: String(taskId) });
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-stretch gap-0",
        isDragging && "pointer-events-none opacity-0",
      )}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-grab touch-none items-center self-stretch rounded-l-xl border border-r-0 border-slate-200/80 bg-slate-50 px-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
        aria-label="Drag to move task"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ProjectTaskListByStatus({
  tasks,
  memberName,
  legacyUserName,
  tagMap,
  onToggleTask,
  onOpenTask,
  onOpenCreateTask,
  projectNameById,
  onDeleteTask,
}: Props) {
  const update = useMutation(api.tasks.update);
  const [activeDragId, setActiveDragId] = useState<Id<"tasks"> | null>(null);
  const [open, setOpen] = useState<Record<TaskStatus, boolean>>(() => {
    const init = {} as Record<TaskStatus, boolean>;
    for (const s of TASK_STATUS_ORDER) init[s] = true;
    return init;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
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

  const activeDragTask =
    activeDragId != null
      ? tasks.find((x) => String(x._id) === String(activeDragId))
      : undefined;

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
      onDragStart={({ active }) =>
        setActiveDragId(active.id as Id<"tasks">)
      }
      onDragCancel={() => setActiveDragId(null)}
      onDragEnd={(e) => void handleDragEnd(e)}
    >
      <div className="space-y-4">
        {TASK_STATUS_ORDER.map((status) => {
          const list = byStatus.get(status) ?? [];
          const isOpen = open[status];
          return (
            <DroppableStatusSection key={status} status={status}>
              <button
                type="button"
                onClick={() =>
                  setOpen((o) => ({ ...o, [status]: !o[status] }))
                }
                className="flex w-full items-center gap-2 border-b border-slate-200/60 bg-slate-50/80 px-3 py-2.5 text-left transition hover:bg-slate-50"
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                    isOpen && "rotate-90",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    TASK_STATUS_DOT_CLASS[status],
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                  {TASK_STATUS_LABEL[status]}
                </span>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200/80">
                  {list.length}
                </span>
              </button>

              {isOpen ? (
                <div className="bg-white">
                  <div className="divide-y divide-slate-100">
                    {list.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-500">
                        No tasks in this status.
                      </p>
                    ) : (
                      list.map((t) => (
                        <div key={t._id} className="px-1 py-1 sm:px-2">
                          <DraggableTaskRow taskId={t._id}>
                            <TaskRow
                              task={t}
                              projectName={
                                projectNameById && t.projectId
                                  ? projectNameById.get(String(t.projectId))
                                  : undefined
                              }
                              assigneeName={
                                t.assigneeMemberId
                                  ? memberName.get(String(t.assigneeMemberId))
                                  : t.assigneeId
                                    ? legacyUserName.get(String(t.assigneeId))
                                    : undefined
                              }
                              labels={t.labelIds.map(
                                (id) => tagMap.get(String(id)) ?? "",
                              )}
                              onToggle={() => onToggleTask(t._id)}
                              onOpen={() => onOpenTask(t._id)}
                              onDelete={
                                onDeleteTask
                                  ? () => onDeleteTask(t._id)
                                  : undefined
                              }
                              className="rounded-r-xl rounded-l-none border border-l-0 border-slate-200/80 shadow-sm ring-0"
                            />
                          </DraggableTaskRow>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-slate-100 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onOpenCreateTask(status)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New task
                    </button>
                  </div>
                </div>
              ) : null}
            </DroppableStatusSection>
          );
        })}
      </div>

      <DragOverlay zIndex={10000}>
        {activeDragTask ? (
          <div className="flex max-w-[min(100vw-2rem,48rem)] cursor-grabbing items-stretch gap-0 rounded-xl shadow-[0_16px_40px_-12px_rgba(15,23,42,0.22)] ring-2 ring-accent-dnd-strong">
            <div
              className="flex shrink-0 cursor-grabbing items-center self-stretch rounded-l-xl border border-r-0 border-slate-200/80 bg-slate-50 px-1.5 text-slate-400"
              aria-hidden
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <TaskRow
                task={activeDragTask}
                projectName={
                  projectNameById && activeDragTask.projectId
                    ? projectNameById.get(String(activeDragTask.projectId))
                    : undefined
                }
                assigneeName={
                  activeDragTask.assigneeMemberId
                    ? memberName.get(String(activeDragTask.assigneeMemberId))
                    : activeDragTask.assigneeId
                      ? legacyUserName.get(String(activeDragTask.assigneeId))
                      : undefined
                }
                labels={activeDragTask.labelIds.map(
                  (id) => tagMap.get(String(id)) ?? "",
                )}
                onToggle={() => {}}
                onOpen={() => {}}
                onDelete={undefined}
                className="rounded-r-xl rounded-l-none border border-l-0 border-slate-200/80 shadow-sm ring-0"
              />
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
