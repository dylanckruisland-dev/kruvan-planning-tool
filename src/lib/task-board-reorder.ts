import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import type { TaskStatus } from "@/lib/task-status";

export type TaskDoc = Doc<"tasks">;

export function taskColumnDroppableId(status: TaskStatus) {
  return `col-${status}`;
}

export function tasksInColumnSorted(
  all: TaskDoc[],
  status: TaskStatus,
): TaskDoc[] {
  return all
    .filter((t) => t.status === status)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        String(a._id).localeCompare(String(b._id)),
    );
}

export function mergeProjectColumnOrder(
  columnSorted: TaskDoc[],
  projectId: Id<"projects">,
  newProjectOrderIds: Id<"tasks">[],
): Id<"tasks">[] {
  const merged: Id<"tasks">[] = [];
  let pi = 0;
  for (const t of columnSorted) {
    if (String(t.projectId) === String(projectId)) {
      merged.push(newProjectOrderIds[pi]);
      pi++;
    } else {
      merged.push(t._id);
    }
  }
  if (pi !== newProjectOrderIds.length) {
    throw new Error("mergeProjectColumnOrder mismatch");
  }
  return merged;
}

type UpdateFn = (args: {
  taskId: Id<"tasks">;
  status: TaskStatus;
}) => Promise<unknown>;

type ReorderFn = (args: {
  workspaceId: Id<"workspaces">;
  status: TaskStatus;
  orderedTaskIds: Id<"tasks">[];
}) => Promise<unknown>;

/**
 * Shared drag-end handler for task board and “by status” list (same Convex rules).
 */
export async function runTaskDragEnd({
  event,
  allTasks,
  workspaceId,
  projectId,
  update,
  reorderColumn,
}: {
  event: DragEndEvent;
  allTasks: TaskDoc[];
  workspaceId: Id<"workspaces">;
  projectId?: Id<"projects">;
  update: UpdateFn;
  reorderColumn: ReorderFn;
}): Promise<void> {
  const { active, over } = event;
  if (!over) return;

  const activeTaskId = String(active.id);
  const moved = allTasks.find((t) => String(t._id) === activeTaskId);
  if (!moved) return;

  const overStr = String(over.id);
  let targetStatus: TaskStatus;
  let overTaskId: string | null = null;

  if (overStr.startsWith("col-")) {
    targetStatus = overStr.slice(4) as TaskStatus;
  } else {
    const overTask = allTasks.find((t) => String(t._id) === overStr);
    if (!overTask) return;
    targetStatus = overTask.status;
    overTaskId = overStr;
  }

  if (moved.status === targetStatus) {
    const column = tasksInColumnSorted(allTasks, targetStatus);
    const ids = column.map((t) => String(t._id));
    const oldIndex = ids.indexOf(activeTaskId);
    const newIndex = overTaskId
      ? ids.indexOf(overTaskId)
      : ids.length - 1;
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    if (projectId) {
      const projectIds = column
        .filter((t) => String(t.projectId) === String(projectId))
        .map((t) => String(t._id));
      if (overTaskId && !projectIds.includes(overTaskId)) return;
      const oi = projectIds.indexOf(activeTaskId);
      const ni = overTaskId
        ? projectIds.indexOf(overTaskId)
        : projectIds.length - 1;
      if (oi === -1 || ni === -1 || oi === ni) return;
      const reordered = arrayMove(projectIds, oi, ni).map(
        (id) => id as Id<"tasks">,
      );
      const full = mergeProjectColumnOrder(column, projectId, reordered);
      await reorderColumn({
        workspaceId,
        status: targetStatus,
        orderedTaskIds: full,
      });
    } else {
      const reordered = arrayMove(ids, oldIndex, newIndex).map(
        (id) => id as Id<"tasks">,
      );
      await reorderColumn({
        workspaceId,
        status: targetStatus,
        orderedTaskIds: reordered,
      });
    }
    return;
  }

  const sourceStatus = moved.status;
  const sourceColumn = tasksInColumnSorted(allTasks, sourceStatus).filter(
    (t) => String(t._id) !== activeTaskId,
  );
  const sourceIds = sourceColumn.map((t) => t._id);

  const targetIds = tasksInColumnSorted(allTasks, targetStatus)
    .filter((t) => String(t._id) !== activeTaskId)
    .map((t) => String(t._id));

  let insertIndex: number;
  if (overStr.startsWith("col-")) {
    insertIndex = targetIds.length;
  } else {
    const idx = targetIds.indexOf(overTaskId!);
    insertIndex = idx === -1 ? targetIds.length : idx;
  }

  const newTargetIds = [...targetIds];
  newTargetIds.splice(insertIndex, 0, activeTaskId);
  const targetOrdered = newTargetIds.map((id) => id as Id<"tasks">);

  await update({
    taskId: activeTaskId as Id<"tasks">,
    status: targetStatus,
  });

  await reorderColumn({
    workspaceId,
    status: sourceStatus,
    orderedTaskIds: sourceIds,
  });

  await reorderColumn({
    workspaceId,
    status: targetStatus,
    orderedTaskIds: targetOrdered,
  });
}
