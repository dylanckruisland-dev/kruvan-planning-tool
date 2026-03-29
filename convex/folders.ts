import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireFolderAccess, requireWorkspaceAccess } from "./authHelpers";

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    return await ctx.db
      .query("folders")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    /** Omit to append after existing siblings (same parent). */
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const name = args.name.trim();
    if (!name) throw new Error("Name is required");
    const all = await ctx.db
      .query("folders")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const wantParent =
      args.parentId === undefined ? "__root__" : String(args.parentId);
    const siblings = all.filter(
      (f) =>
        (f.parentId === undefined ? "__root__" : String(f.parentId)) ===
        wantParent,
    );
    const sortOrder =
      args.sortOrder ??
      siblings.reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;
    return await ctx.db.insert("folders", {
      workspaceId: args.workspaceId,
      name,
      parentId: args.parentId,
      sortOrder,
    });
  },
});

export const remove = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, { folderId }) => {
    const root = await requireFolderAccess(ctx, folderId);
    const workspaceId = root.workspaceId;

    async function deleteTree(id: Id<"folders">) {
      const children = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q) => q.eq("parentId", id))
        .collect();
      for (const c of children) {
        await deleteTree(c._id);
      }
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_folder", (q) => q.eq("folderId", id))
        .collect();
      for (const p of projects) {
        await ctx.db.patch(p._id, { folderId: undefined });
      }
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", workspaceId),
        )
        .collect();
      for (const n of notes) {
        if (n.folderId === id) {
          await ctx.db.patch(n._id, { folderId: undefined });
        }
      }
      await ctx.db.delete(id);
    }

    await deleteTree(folderId);
  },
});

export const update = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.optional(v.string()),
    parentId: v.optional(v.union(v.id("folders"), v.null())),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { folderId, ...patch }) => {
    await requireFolderAccess(ctx, folderId);
    const next: Record<string, unknown> = {};
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.parentId !== undefined) next.parentId = patch.parentId ?? undefined;
    if (patch.sortOrder !== undefined) next.sortOrder = patch.sortOrder;
    await ctx.db.patch(folderId, next);
  },
});
