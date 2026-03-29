import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireTaskAccess, requireWorkspaceAccess } from "./authHelpers";

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

function normalizeSubtasks(
  items: { id: string; title: string; done: boolean }[] | undefined,
) {
  if (!items?.length) return undefined;
  const cleaned = items
    .map((s) => ({ ...s, title: s.title.trim() }))
    .filter((s) => s.title.length > 0);
  return cleaned.length === 0 ? undefined : cleaned;
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
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const { subtasks, ...rest } = args;
    return await ctx.db.insert("tasks", {
      ...rest,
      subtasks: normalizeSubtasks(subtasks),
    });
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
  },
  handler: async (ctx, { taskId, ...rest }) => {
    await requireTaskAccess(ctx, taskId);
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
    }
    if (rest.priority !== undefined) patch.priority = rest.priority;
    if (rest.assigneeMemberId !== undefined) {
      patch.assigneeMemberId = rest.assigneeMemberId ?? undefined;
    }
    if (rest.projectId !== undefined) {
      patch.projectId = rest.projectId ?? undefined;
    }
    if (rest.labelIds !== undefined) patch.labelIds = rest.labelIds;
    if (rest.subtasks !== undefined) {
      patch.subtasks = normalizeSubtasks(rest.subtasks);
    }
    await ctx.db.patch(taskId, patch);
  },
});

export const toggleComplete = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const t = await requireTaskAccess(ctx, taskId);
    const done = t.status === "done";
    await ctx.db.patch(taskId, {
      status: done ? "todo" : "done",
      completedAt: done ? undefined : Date.now(),
    });
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    await requireTaskAccess(ctx, taskId);
    await ctx.db.delete(taskId);
  },
});
