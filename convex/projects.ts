import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireProjectAccess, requireWorkspaceAccess } from "./authHelpers";

const priority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);

const status = v.union(
  v.literal("planning"),
  v.literal("active"),
  v.literal("on_hold"),
  v.literal("done"),
);

const dueFilter = v.union(
  v.literal("no_date"),
  v.literal("overdue"),
  v.literal("next7"),
);

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    folderId: v.optional(v.id("folders")),
    status: v.optional(status),
    priority: v.optional(priority),
    tagId: v.optional(v.id("tags")),
    dueFilter: v.optional(dueFilter),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const {
      workspaceId,
      folderId,
      status: st,
      priority: pr,
      tagId,
      dueFilter: df,
      search,
    } = args;

    let rows = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    if (folderId) {
      rows = rows.filter((p) => p.folderId === folderId);
    }
    if (st) {
      rows = rows.filter((p) => p.status === st);
    }
    if (pr) {
      rows = rows.filter((p) => p.priority === pr);
    }
    if (tagId) {
      rows = rows.filter((p) => p.tagIds.includes(tagId));
    }
    if (df) {
      const now = Date.now();
      const sod = new Date(now);
      sod.setHours(0, 0, 0, 0);
      const start = sod.getTime();
      const weekEnd = start + 7 * 86400000;
      rows = rows.filter((p) => {
        const d = p.dueDate;
        if (df === "no_date") return d === undefined;
        if (d === undefined) return false;
        if (df === "overdue") return d < start;
        if (df === "next7") return d >= start && d < weekEnd;
        return true;
      });
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false),
      );
    }
    return rows;
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await requireProjectAccess(ctx, projectId);
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    folderId: v.optional(v.id("folders")),
    name: v.string(),
    description: v.optional(v.string()),
    status: status,
    priority,
    dueDate: v.optional(v.number()),
    progress: v.number(),
    tagIds: v.array(v.id("tags")),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return await ctx.db.insert("projects", args);
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(status),
    priority: v.optional(priority),
    dueDate: v.optional(v.union(v.number(), v.null())),
    progress: v.optional(v.number()),
    folderId: v.optional(v.union(v.id("folders"), v.null())),
    tagIds: v.optional(v.array(v.id("tags"))),
  },
  handler: async (ctx, { projectId, ...rest }) => {
    await requireProjectAccess(ctx, projectId);
    const patch: Record<string, unknown> = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.description !== undefined) patch.description = rest.description;
    if (rest.status !== undefined) patch.status = rest.status;
    if (rest.priority !== undefined) patch.priority = rest.priority;
    if (rest.dueDate !== undefined) {
      patch.dueDate = rest.dueDate === null ? undefined : rest.dueDate;
    }
    if (rest.progress !== undefined) patch.progress = rest.progress;
    if (rest.folderId !== undefined) {
      patch.folderId = rest.folderId ?? undefined;
    }
    if (rest.tagIds !== undefined) patch.tagIds = rest.tagIds;
    await ctx.db.patch(projectId, patch);
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await requireProjectAccess(ctx, projectId);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const t of tasks) {
      await ctx.db.patch(t._id, { projectId: undefined });
    }

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", project.workspaceId))
      .collect();
    for (const n of notes) {
      if (n.projectId === projectId) {
        await ctx.db.patch(n._id, { projectId: undefined });
      }
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", project.workspaceId))
      .collect();
    for (const e of events) {
      if (e.projectId === projectId) {
        await ctx.db.patch(e._id, { projectId: undefined });
      }
    }

    const contentPlans = await ctx.db
      .query("contentPlans")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const c of contentPlans) {
      await ctx.db.patch(c._id, { projectId: undefined });
    }

    await ctx.db.delete(projectId);
  },
});
