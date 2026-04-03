import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  assertFolderInWorkspace,
  requireAuthUserId,
  requireProjectAccess,
  requireWorkspaceAccess,
} from "./authHelpers";
import { insertProjectActivity } from "./projectActivity";

async function nextSortOrderForTaskStatus(
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
    if (args.folderId) {
      await assertFolderInWorkspace(ctx, args.folderId, args.workspaceId);
    }
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
    const project = await requireProjectAccess(ctx, projectId);
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
      if (rest.folderId !== null) {
        await assertFolderInWorkspace(ctx, rest.folderId, project.workspaceId);
      }
      patch.folderId = rest.folderId ?? undefined;
    }
    if (rest.tagIds !== undefined) patch.tagIds = rest.tagIds;
    await ctx.db.patch(projectId, patch);
    const userId = await requireAuthUserId(ctx);
    const summaryParts: string[] = [];
    if (rest.name !== undefined) summaryParts.push(`name → ${rest.name}`);
    if (rest.status !== undefined) summaryParts.push(`status → ${rest.status}`);
    if (rest.progress !== undefined) summaryParts.push(`progress → ${rest.progress}%`);
    if (summaryParts.length > 0) {
      await insertProjectActivity(ctx, {
        workspaceId: project.workspaceId,
        projectId,
        actorUserId: userId,
        kind: "project_updated",
        summary: summaryParts.join(", "),
      });
    }
  },
});

export const duplicate = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, name }) => {
    const src = await requireProjectAccess(ctx, projectId);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();
    const newName = name?.trim() || `Copy of ${src.name}`;
    const newProjectId = await ctx.db.insert("projects", {
      workspaceId: src.workspaceId,
      folderId: src.folderId,
      name: newName,
      description: src.description,
      status: src.status,
      priority: src.priority,
      dueDate: src.dueDate,
      progress: 0,
      tagIds: src.tagIds,
    });

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const idMap = new Map<string, Id<"tasks">>();
    for (const t of tasks) {
      const sortOrder = await nextSortOrderForTaskStatus(
        ctx,
        t.workspaceId,
        t.status,
      );
      const newId = await ctx.db.insert("tasks", {
        workspaceId: t.workspaceId,
        projectId: newProjectId,
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        scheduledStart: t.scheduledStart,
        scheduledEnd: t.scheduledEnd,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assigneeId,
        assigneeMemberId: t.assigneeMemberId,
        labelIds: t.labelIds,
        sortOrder,
        subtasks: t.subtasks,
        recurrence: t.recurrence,
        completedAt: t.completedAt,
      });
      idMap.set(String(t._id), newId);
    }
    for (const t of tasks) {
      if (!t.blockedByTaskId) continue;
      const newB = idMap.get(String(t.blockedByTaskId));
      const newT = idMap.get(String(t._id));
      if (newB && newT) {
        await ctx.db.patch(newT, { blockedByTaskId: newB });
      }
    }

    const plans = await ctx.db
      .query("contentPlans")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const c of plans) {
      await ctx.db.insert("contentPlans", {
        workspaceId: c.workspaceId,
        projectId: newProjectId,
        title: c.title,
        notes: c.notes,
        contentFormat: c.contentFormat,
        platforms: c.platforms,
        customPlatforms: c.customPlatforms,
        status: c.status,
        scheduledFor: c.scheduledFor,
        publishedAt: c.publishedAt,
        attachments: c.attachments,
        createdAt: now,
        updatedAt: now,
      });
    }

    await insertProjectActivity(ctx, {
      workspaceId: src.workspaceId,
      projectId: newProjectId,
      actorUserId: userId,
      kind: "project_duplicated",
      summary: `Duplicated from “${src.name}”`,
    });

    return newProjectId;
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
