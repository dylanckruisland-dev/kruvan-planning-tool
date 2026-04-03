import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  requireWorkspaceAccess,
  requireWorkspaceMemberAccess,
} from "./authHelpers";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Idempotent: one assignee row per workspace user, matched by email when present. */
export async function ensureWorkspaceAssigneeForUser(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const name =
    user.name?.trim() ||
    (user.email ? user.email.split("@")[0] : null) ||
    "Member";
  const email = user.email?.trim();
  const existing = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  if (email) {
    const dup = existing.find(
      (e) => e.email && normalizeEmail(e.email) === normalizeEmail(email),
    );
    if (dup) return;
  } else {
    const dup = existing.find(
      (e) =>
        !e.email &&
        e.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (dup) return;
  }
  await ctx.db.insert("workspaceMembers", {
    workspaceId,
    name,
    email: email || undefined,
  });
}

export async function removeWorkspaceAssigneeForUser(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const rows = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  let row = null as (typeof rows)[number] | null;
  if (user?.email) {
    const email = normalizeEmail(user.email);
    row =
      rows.find(
        (r) => r.email && normalizeEmail(r.email) === email,
      ) ?? null;
  } else if (user) {
    const name =
      user.name?.trim() ||
      (user.email ? user.email.split("@")[0] : null) ||
      "Member";
    row =
      rows.find(
        (r) =>
          !r.email &&
          r.name.trim().toLowerCase() === name.trim().toLowerCase(),
      ) ?? null;
  }
  if (!row) return;

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const t of tasks) {
    if (t.assigneeMemberId === row._id) {
      await ctx.db.patch(t._id, { assigneeMemberId: undefined });
    }
  }
  await ctx.db.delete(row._id);
}

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

/** Backfill assignee rows for owner + all collaborators (safe to run multiple times). */
export const syncCollaboratorsToAssignees = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) return;
    if (workspace.ownerId) {
      await ensureWorkspaceAssigneeForUser(ctx, workspaceId, workspace.ownerId);
    }
    const memberships = await ctx.db
      .query("workspaceUserMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const m of memberships) {
      await ensureWorkspaceAssigneeForUser(ctx, workspaceId, m.userId);
    }
  },
});
