import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireWorkspaceAccess,
  requireWorkspaceMemberAccess,
} from "./authHelpers";

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    return await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const name = args.name.trim();
    if (!name) throw new Error("Name is required");
    return await ctx.db.insert("workspaceMembers", {
      workspaceId: args.workspaceId,
      name,
      email: args.email?.trim() || undefined,
    });
  },
});

export const update = mutation({
  args: {
    memberId: v.id("workspaceMembers"),
    name: v.optional(v.string()),
    email: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { memberId, name, email }) => {
    await requireWorkspaceMemberAccess(ctx, memberId);
    const patch: Record<string, unknown> = {};
    if (name !== undefined) {
      const n = name.trim();
      if (!n) throw new Error("Name is required");
      patch.name = n;
    }
    if (email !== undefined) {
      patch.email = email === null ? undefined : email.trim() || undefined;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(memberId, patch);
    }
  },
});

export const remove = mutation({
  args: { memberId: v.id("workspaceMembers") },
  handler: async (ctx, { memberId }) => {
    const m = await requireWorkspaceMemberAccess(ctx, memberId);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", m.workspaceId))
      .collect();
    for (const t of tasks) {
      if (t.assigneeMemberId === memberId) {
        await ctx.db.patch(t._id, { assigneeMemberId: undefined });
      }
    }
    await ctx.db.delete(memberId);
  },
});
