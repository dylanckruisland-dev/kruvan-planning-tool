import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  assertProjectInWorkspace,
  assertWorkspaceMemberInWorkspace,
  requireAuthUserId,
  requireTaskAccess,
  requireWorkspaceAccess,
} from "./authHelpers";
import { insertProjectActivity } from "./projectActivity";

const priority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);

const status = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("cancelled"),
);

const subtask = v.object({
  id: v.string(),
  title: v.string(),
  done: v.boolean(),
});

const recurrenceValue = v.object({
  freq: v.union(
    v.literal("daily"),
    v.literal("weekly"),
    v.literal("monthly"),
  ),
  interval: v.number(),
  anchor: v.optional(v.number()),
  until: v.optional(v.number()),
});

export type TaskRecurrence = {
  freq: "daily" | "weekly" | "monthly";
  interval: number;
  anchor?: number;
  until?: number;
};

/** Next due timestamp after completing an instance, or null if series ended. */
export function computeNextDueMs(
  fromDueMs: number,
  r: TaskRecurrence,
): number | null {
  const interval = Math.max(1, Math.floor(r.interval));
  const d = new Date(fromDueMs);
  if (r.freq === "daily") {
    d.setDate(d.getDate() + interval);
    d.setHours(0, 0, 0, 0);
    const next = d.getTime();
    if (r.until != null && next > r.until) return null;
    return next;
  }
  if (r.freq === "weekly") {
    const targetDay = r.anchor ?? d.getDay();
    const next = new Date(fromDueMs);
    next.setDate(next.getDate() + 7 * interval);
    const diff = (targetDay - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + diff);
    next.setHours(0, 0, 0, 0);
    if (r.until != null && next.getTime() > r.until) return null;
    return next.getTime();
  }
  if (r.freq === "monthly") {
    d.setMonth(d.getMonth() + interval);
    d.setHours(0, 0, 0, 0);
    const next = d.getTime();
    if (r.until != null && next > r.until) return null;
    return next;
  }
  return null;
}

function normalizeSubtasks(
  items: { id: string; title: string; done: boolean }[] | undefined,
) {
  if (!items?.length) return undefined;
  const cleaned = items
    .map((s) => ({ ...s, title: s.title.trim() }))
    .filter((s) => s.title.length > 0);
  return cleaned.length === 0 ? undefined : cleaned;
}

async function nextSortOrderForStatus(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  taskStatus: "todo" | "in_progress" | "done" | "cancelled",
) {
  const rows = await ctx.db
    .query("tasks")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  let max = -1;
  for (const t of rows) {
    if (t.status !== taskStatus) continue;
    const o = t.sortOrder ?? 0;
    if (o > max) max = o;
  }
  return max + 1;
}

function compareTasksForList<
  T extends { _id: Id<"tasks">; sortOrder?: number },
>(a: T, b: T) {
  const ao = a.sortOrder ?? 0;
  const bo = b.sortOrder ?? 0;
  if (ao !== bo) return ao - bo;
  return String(a._id).localeCompare(String(b._id));
}

async function assertValidBlockedBy(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  taskId: Id<"tasks">,
  blockerId: Id<"tasks"> | undefined,
) {
  if (blockerId === undefined) return;
  if (blockerId === taskId) throw new Error("Task cannot block itself");
  const blocker = await ctx.db.get(blockerId);
  if (!blocker || blocker.workspaceId !== workspaceId) {
    throw new Error("Blocked-by task not found in this workspace");
  }
}

async function tryRecurInsteadOfCompleting(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  task: Doc<"tasks">,
  actorUserId: Id<"users">,
): Promise<boolean> {
  if (!task.recurrence) return false;
  const base = task.dueDate ?? Date.now();
  const nextDue = computeNextDueMs(base, task.recurrence);
  if (nextDue === null) return false;
  const sortOrder = await nextSortOrderForStatus(
    ctx,
    task.workspaceId,
    "todo",
  );
  await ctx.db.patch(taskId, {
    status: "todo",
    completedAt: undefined,
    dueDate: nextDue,
    sortOrder,
  });
  if (task.projectId) {
    await insertProjectActivity(ctx, {
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      actorUserId,
      kind: "task_completed",
      summary: `Completed (next: ${new Date(nextDue).toLocaleDateString()}): ${task.title}`,
      taskId,
    });
  }
  return true;
}

/** Tasks with a due date whose calendar day falls in [start, end] (both compared at local-midnight via stored timestamps). */
export const listDueInRange = query({
  args: {
    workspaceId: v.id("workspaces"),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, { workspaceId, start, end }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    return rows.filter((t) => {
      if (t.status === "done" || t.status === "cancelled") return false;
      if (t.dueDate == null) return false;
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      const dayMs = d.getTime();
      return dayMs >= start && dayMs <= end;
    });
  },
});

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    status: v.optional(status),
    priority: v.optional(priority),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    let rows = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (args.projectId) {
      rows = rows.filter((t) => t.projectId === args.projectId);
    }
    if (args.status) {
      rows = rows.filter((t) => t.status === args.status);
    }
    if (args.priority) {
      rows = rows.filter((t) => t.priority === args.priority);
    }
    if (args.search && args.search.trim()) {
      const q = args.search.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false) ||
          (t.subtasks?.some((s) => s.title.toLowerCase().includes(q)) ?? false),
      );
    }
    rows.sort(compareTasksForList);
    return rows;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    scheduledStart: v.optional(v.number()),
    scheduledEnd: v.optional(v.number()),
    status,
    priority,
    assigneeMemberId: v.optional(v.id("workspaceMembers")),
    labelIds: v.array(v.id("tags")),
    subtasks: v.optional(v.array(subtask)),
    blockedByTaskId: v.optional(v.id("tasks")),
    recurrence: v.optional(recurrenceValue),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    if (args.projectId) {
      await assertProjectInWorkspace(ctx, args.projectId, args.workspaceId);
    }
    if (args.assigneeMemberId) {
      await assertWorkspaceMemberInWorkspace(
        ctx,
        args.assigneeMemberId,
        args.workspaceId,
      );
    }
    if (args.recurrence && args.recurrence.interval < 1) {
      throw new Error("Recurrence interval must be at least 1");
    }
    const { subtasks, blockedByTaskId, recurrence, ...rest } = args;
    const sortOrder = await nextSortOrderForStatus(
      ctx,
      args.workspaceId,
      args.status,
    );
    const id = await ctx.db.insert("tasks", {
      ...rest,
      subtasks: normalizeSubtasks(subtasks),
      blockedByTaskId: undefined,
      recurrence,
      sortOrder,
    });
    if (blockedByTaskId) {
      await assertValidBlockedBy(
        ctx,
        args.workspaceId,
        id,
        blockedByTaskId,
      );
      await ctx.db.patch(id, { blockedByTaskId });
    }
    const userId = await requireAuthUserId(ctx);
    if (args.projectId) {
      await insertProjectActivity(ctx, {
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        actorUserId: userId,
        kind: "task_created",
        summary: `Task created: ${args.title.trim()}`,
        taskId: id,
      });
    }
    return id;
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.union(v.number(), v.null())),
    scheduledStart: v.optional(v.union(v.number(), v.null())),
    scheduledEnd: v.optional(v.union(v.number(), v.null())),
    status: v.optional(status),
    priority: v.optional(priority),
    assigneeMemberId: v.optional(
      v.union(v.id("workspaceMembers"), v.null()),
    ),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    labelIds: v.optional(v.array(v.id("tags"))),
    subtasks: v.optional(v.array(subtask)),
    blockedByTaskId: v.optional(v.union(v.id("tasks"), v.null())),
    recurrence: v.optional(v.union(recurrenceValue, v.null())),
  },
  handler: async (ctx, { taskId, ...rest }) => {
    const existing = await requireTaskAccess(ctx, taskId);
    const userId = await requireAuthUserId(ctx);

    if (rest.status === "done" && existing.status !== "done" && existing.recurrence) {
      const handled = await tryRecurInsteadOfCompleting(
        ctx,
        taskId,
        existing,
        userId,
      );
      if (handled) return;
    }

    const patch: Record<string, unknown> = {};
    if (rest.title !== undefined) patch.title = rest.title;
    if (rest.description !== undefined) patch.description = rest.description;
    if (rest.dueDate !== undefined) {
      patch.dueDate = rest.dueDate === null ? undefined : rest.dueDate;
    }
    if (rest.scheduledStart !== undefined) {
      patch.scheduledStart =
        rest.scheduledStart === null ? undefined : rest.scheduledStart;
    }
    if (rest.scheduledEnd !== undefined) {
      patch.scheduledEnd =
        rest.scheduledEnd === null ? undefined : rest.scheduledEnd;
    }
    if (rest.status !== undefined) {
      patch.status = rest.status;
      if (rest.status === "done") {
        patch.completedAt = Date.now();
      } else {
        patch.completedAt = undefined;
      }
      if (rest.status !== existing.status) {
        patch.sortOrder = await nextSortOrderForStatus(
          ctx,
          existing.workspaceId,
          rest.status,
        );
      }
    }
    if (rest.priority !== undefined) patch.priority = rest.priority;
    if (rest.assigneeMemberId !== undefined) {
      if (rest.assigneeMemberId !== null) {
        await assertWorkspaceMemberInWorkspace(
          ctx,
          rest.assigneeMemberId,
          existing.workspaceId,
        );
      }
      patch.assigneeMemberId = rest.assigneeMemberId ?? undefined;
    }
    if (rest.projectId !== undefined) {
      if (rest.projectId !== null) {
        await assertProjectInWorkspace(
          ctx,
          rest.projectId,
          existing.workspaceId,
        );
      }
      patch.projectId = rest.projectId ?? undefined;
    }
    if (rest.labelIds !== undefined) patch.labelIds = rest.labelIds;
    if (rest.subtasks !== undefined) {
      patch.subtasks = normalizeSubtasks(rest.subtasks);
    }
    if (rest.recurrence !== undefined) {
      if (rest.recurrence === null) {
        patch.recurrence = undefined;
      } else {
        if (rest.recurrence.interval < 1) {
          throw new Error("Recurrence interval must be at least 1");
        }
        patch.recurrence = rest.recurrence;
      }
    }
    if (rest.blockedByTaskId !== undefined) {
      if (rest.blockedByTaskId === null) {
        patch.blockedByTaskId = undefined;
      } else {
        await assertValidBlockedBy(
          ctx,
          existing.workspaceId,
          taskId,
          rest.blockedByTaskId,
        );
        patch.blockedByTaskId = rest.blockedByTaskId;
      }
    }
    await ctx.db.patch(taskId, patch);

    if (rest.status === "done" && existing.status !== "done" && existing.projectId) {
      await insertProjectActivity(ctx, {
        workspaceId: existing.workspaceId,
        projectId: existing.projectId,
        actorUserId: userId,
        kind: "task_completed",
        summary: `Completed: ${existing.title}`,
        taskId,
      });
    }
    const titleChanged = rest.title !== undefined && rest.title !== existing.title;
    if (titleChanged && existing.projectId) {
      await insertProjectActivity(ctx, {
        workspaceId: existing.workspaceId,
        projectId: existing.projectId,
        actorUserId: userId,
        kind: "task_updated",
        summary: `Task renamed: ${rest.title}`,
        taskId,
      });
    }
  },
});

export const toggleComplete = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const t = await requireTaskAccess(ctx, taskId);
    const userId = await requireAuthUserId(ctx);
    const done = t.status === "done";
    if (!done && t.recurrence) {
      const handled = await tryRecurInsteadOfCompleting(ctx, taskId, t, userId);
      if (handled) return;
    }
    const nextStatus = done ? "todo" : "done";
    const sortOrder = await nextSortOrderForStatus(ctx, t.workspaceId, nextStatus);
    await ctx.db.patch(taskId, {
      status: nextStatus,
      completedAt: done ? undefined : Date.now(),
      sortOrder,
    });
    if (!done && nextStatus === "done" && t.projectId) {
      await insertProjectActivity(ctx, {
        workspaceId: t.workspaceId,
        projectId: t.projectId,
        actorUserId: userId,
        kind: "task_completed",
        summary: `Completed: ${t.title}`,
        taskId,
      });
    }
  },
});

export const reorderTasksInColumn = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    status: status,
    orderedTaskIds: v.array(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const all = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const inStatus = all.filter((t) => t.status === args.status);
    if (inStatus.length !== args.orderedTaskIds.length) {
      throw new Error("Order must list every task in this status");
    }
    const want = new Set(args.orderedTaskIds.map(String));
    for (const t of inStatus) {
      if (!want.has(String(t._id))) {
        throw new Error("Order must list every task in this status");
      }
    }
    for (let i = 0; i < args.orderedTaskIds.length; i++) {
      await requireTaskAccess(ctx, args.orderedTaskIds[i]);
      await ctx.db.patch(args.orderedTaskIds[i], { sortOrder: i });
    }
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const t = await requireTaskAccess(ctx, taskId);
    const others = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", t.workspaceId))
      .collect();
    for (const o of others) {
      if (o.blockedByTaskId === taskId) {
        await ctx.db.patch(o._id, { blockedByTaskId: undefined });
      }
    }
    await ctx.db.delete(taskId);
  },
});
