import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireWorkspaceAccess } from "./authHelpers";

function taskOnAgenda(t: {
  status: string;
  dueDate?: number;
  scheduledStart?: number;
}) {
  if (t.status === "done" || t.status === "cancelled") return false;
  return t.scheduledStart != null || t.dueDate != null;
}

export const getOverview = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const events = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const workspaceMembers = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const userIdSet = new Set<Id<"users">>();
    for (const t of tasks) {
      if (t.assigneeId) userIdSet.add(t.assigneeId);
    }
    const users = (
      await Promise.all(
        Array.from(userIdSet, (id) => ctx.db.get(id)),
      )
    ).filter((u): u is NonNullable<typeof u> => u != null);
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayEvents = events.filter(
      (e) =>
        e.startTime < dayEnd.getTime() && e.endTime > dayStart.getTime(),
    );
    const agendaTasks = tasks
      .filter(
        (t) =>
          taskOnAgenda(t) &&
          t.status !== "done" &&
          t.status !== "cancelled",
      )
      .slice(0, 12);

    const now = Date.now();

    const upcomingEvents = events
      .filter((e) => e.startTime >= now)
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 8);

    const upcomingTasks = tasks
      .filter((t) => t.status !== "done" && t.status !== "cancelled")
      .sort(
        (a, b) =>
          (a.dueDate ?? Number.MAX_SAFE_INTEGER) -
          (b.dueDate ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, 8);

    const recentProjects = [...projects]
      .sort((a, b) => (b.dueDate ?? 0) - (a.dueDate ?? 0))
      .slice(0, 4);

    const todayTasks = tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "cancelled" &&
        t.dueDate != null &&
        t.dueDate >= dayStart.getTime() &&
        t.dueDate < dayEnd.getTime(),
    );

    return {
      projects,
      tasks,
      events,
      notes,
      workspaceMembers,
      users,
      tags,
      dayEvents,
      agendaTasks,
      upcomingEvents,
      upcomingTasks,
      recentProjects,
      todayTasks,
    };
  },
});
