import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireProjectAccess } from "./authHelpers";

export type ProjectActivityKind =
  | "task_created"
  | "task_completed"
  | "task_updated"
  | "project_updated"
  | "project_duplicated";

export async function insertProjectActivity(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    projectId: Id<"projects">;
    actorUserId: Id<"users">;
    kind: ProjectActivityKind;
    summary: string;
    taskId?: Id<"tasks">;
  },
) {
  await ctx.db.insert("projectActivities", {
    workspaceId: args.workspaceId,
    projectId: args.projectId,
    actorUserId: args.actorUserId,
    kind: args.kind,
    summary: args.summary,
    taskId: args.taskId,
    createdAt: Date.now(),
  });
}

export const listForProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit }) => {
    await requireProjectAccess(ctx, projectId);
    const cap = Math.min(Math.max(limit ?? 40, 1), 100);
    const all = await ctx.db
      .query("projectActivities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const rows = all
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, cap);
    const users = new Map<Id<"users">, { name?: string; email?: string }>();
    for (const r of rows) {
      if (!users.has(r.actorUserId)) {
        const u = await ctx.db.get(r.actorUserId);
        if (u) users.set(r.actorUserId, { name: u.name, email: u.email });
      }
    }
    return rows.map((r) => ({
      _id: r._id,
      kind: r.kind,
      summary: r.summary,
      taskId: r.taskId,
      createdAt: r.createdAt,
      actorUserId: r.actorUserId,
      actorName:
        users.get(r.actorUserId)?.name?.trim() ||
        users.get(r.actorUserId)?.email?.split("@")[0] ||
        "Someone",
    }));
  },
});
