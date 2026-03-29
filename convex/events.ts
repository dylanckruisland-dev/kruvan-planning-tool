import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireEventAccess, requireWorkspaceAccess } from "./authHelpers";

export const listInRange = query({
  args: {
    workspaceId: v.id("workspaces"),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, { workspaceId, start, end }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const all = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    return all.filter(
      (e) =>
        (e.startTime >= start && e.startTime <= end) ||
        (e.endTime >= start && e.endTime <= end) ||
        (e.startTime <= start && e.endTime >= end),
    );
  },
});

export const listUpcoming = query({
  args: {
    workspaceId: v.id("workspaces"),
    from: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, from, limit }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const all = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const upcoming = all
      .filter((e) => e.endTime >= from)
      .sort((a, b) => a.startTime - b.startTime);
    return upcoming.slice(0, limit ?? 50);
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    taskId: v.optional(v.id("tasks")),
    projectId: v.optional(v.id("projects")),
    allDay: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return await ctx.db.insert("events", args);
  },
});

export const update = mutation({
  args: {
    eventId: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    taskId: v.optional(v.union(v.id("tasks"), v.null())),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    allDay: v.optional(v.boolean()),
  },
  handler: async (ctx, { eventId, ...rest }) => {
    await requireEventAccess(ctx, eventId);
    const patch: Record<string, unknown> = {};
    if (rest.title !== undefined) patch.title = rest.title;
    if (rest.description !== undefined) patch.description = rest.description;
    if (rest.startTime !== undefined) patch.startTime = rest.startTime;
    if (rest.endTime !== undefined) patch.endTime = rest.endTime;
    if (rest.taskId !== undefined) patch.taskId = rest.taskId ?? undefined;
    if (rest.projectId !== undefined) {
      patch.projectId = rest.projectId ?? undefined;
    }
    if (rest.allDay !== undefined) patch.allDay = rest.allDay;
    await ctx.db.patch(eventId, patch);
  },
});

export const remove = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireEventAccess(ctx, eventId);
    await ctx.db.delete(eventId);
  },
});
