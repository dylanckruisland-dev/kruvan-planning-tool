import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./authHelpers";

/** Projects, folders, tags, and members for voice parsing. */
export const workspaceSnapshotForVoice = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    return {
      projects: projects.map((p) => ({ id: p._id, name: p.name })),
      folders: folders.map((f) => ({ id: f._id, name: f.name })),
      tags: tags.map((t) => ({ id: t._id, name: t.name })),
      members: members.map((m) => ({ id: m._id, name: m.name })),
    };
  },
});
