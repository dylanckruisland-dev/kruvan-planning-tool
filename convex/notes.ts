import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireNoteAccess, requireWorkspaceAccess } from "./authHelpers";

function createdMs(n: { createdAt?: number; updatedAt: number }) {
  return n.createdAt ?? n.updatedAt;
}

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    folderId: v.optional(v.id("folders")),
    search: v.optional(v.string()),
    /** Inclusive lower bound on creation time (ms). */
    createdFrom: v.optional(v.number()),
    /** Inclusive upper bound on creation time (ms). */
    createdTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const { workspaceId, projectId, folderId, search, createdFrom, createdTo } =
      args;
    let rows = await ctx.db
      .query("notes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    if (projectId) {
      rows = rows.filter((n) => n.projectId === projectId);
    }
    if (folderId) {
      rows = rows.filter((n) => n.folderId === folderId);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q),
      );
    }
    if (createdFrom !== undefined) {
      rows = rows.filter((n) => createdMs(n) >= createdFrom);
    }
    if (createdTo !== undefined) {
      rows = rows.filter((n) => createdMs(n) <= createdTo);
    }
    return rows.sort((a, b) => createdMs(b) - createdMs(a));
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    folderId: v.optional(v.id("folders")),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const now = Date.now();
    return await ctx.db.insert("notes", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    noteId: v.id("notes"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    folderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, { noteId, ...rest }) => {
    await requireNoteAccess(ctx, noteId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (rest.title !== undefined) patch.title = rest.title;
    if (rest.body !== undefined) patch.body = rest.body;
    if (rest.projectId !== undefined) {
      patch.projectId = rest.projectId ?? undefined;
    }
    if (rest.folderId !== undefined) {
      patch.folderId = rest.folderId ?? undefined;
    }
    await ctx.db.patch(noteId, patch);
  },
});

export const remove = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    await requireNoteAccess(ctx, noteId);
    await ctx.db.delete(noteId);
  },
});
