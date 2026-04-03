import {
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  requireAuthUserId,
  requireWorkspaceAccess,
  requireWorkspaceAdminOrOwner,
  requireWorkspaceOwner,
} from "./authHelpers";
import {
  ensureWorkspaceAssigneeForUser,
  removeWorkspaceAssigneeForUser,
} from "./workspaceMembers";

const roleValidator = v.union(v.literal("admin"), v.literal("member"));

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Index lookup is exact; fall back to a scan for case-insensitive match (small user sets). */
async function findUserByEmailNormalized(
  ctx: QueryCtx,
  email: string,
): Promise<Doc<"users"> | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const direct = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalized))
    .first();
  if (direct) return direct;
  const directRaw = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email.trim()))
    .first();
  if (directRaw) return directRaw;
  const all = await ctx.db.query("users").collect();
  return (
    all.find((u) => u.email && normalizeEmail(u.email) === normalized) ?? null
  );
}

export const listMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) return [];

    type Row = {
      kind: "owner" | "admin" | "member";
      userId: Id<"users">;
      name: string | null;
      email: string | null;
      image?: string | null;
      membershipId?: Id<"workspaceUserMemberships">;
    };

    const members: Row[] = [];

    if (workspace.ownerId) {
      const owner = await ctx.db.get(workspace.ownerId);
      if (owner) {
        members.push({
          kind: "owner",
          userId: workspace.ownerId,
          name: owner.name ?? null,
          email: owner.email ?? null,
          image: owner.image,
        });
      }
    }

    const rows = await ctx.db
      .query("workspaceUserMemberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const row of rows) {
      const u = await ctx.db.get(row.userId);
      if (!u) continue;
      members.push({
        kind: row.role,
        userId: row.userId,
        name: u.name ?? null,
        email: u.email ?? null,
        image: u.image,
        membershipId: row._id,
      });
    }

    const rank = (k: Row["kind"]) =>
      k === "owner" ? 0 : k === "admin" ? 1 : 2;
    members.sort((a, b) => {
      const d = rank(a.kind) - rank(b.kind);
      if (d !== 0) return d;
      const an = (a.name ?? a.email ?? "").toLowerCase();
      const bn = (b.name ?? b.email ?? "").toLowerCase();
      return an.localeCompare(bn);
    });

    return members;
  },
});

export const listOutgoingInvites = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAdminOrOwner(ctx, workspaceId);
    const invites = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const pending = invites.filter((i) => i.status === "pending");
    const result = [];
    for (const inv of pending) {
      const inviter = await ctx.db.get(inv.invitedByUserId);
      result.push({
        inviteId: inv._id,
        email: inv.email,
        role: inv.role,
        createdAt: inv.createdAt,
        invitedByName: inviter?.name ?? inviter?.email ?? "Someone",
      });
    }
    result.sort((a, b) => b.createdAt - a.createdAt);
    return result;
  },
});

export const listMyPendingInvites = query({
  args: v.object({}),
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const user = await ctx.db.get(userId);
    const emailRaw = user?.email;
    if (!emailRaw) return [];
    const email = normalizeEmail(emailRaw);
    const invites = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_email_status", (q) =>
        q.eq("email", email).eq("status", "pending"),
      )
      .collect();
    const out = [];
    for (const inv of invites) {
      const ws = await ctx.db.get(inv.workspaceId);
      if (!ws) continue;
      const inviter = await ctx.db.get(inv.invitedByUserId);
      out.push({
        inviteId: inv._id,
        workspaceId: inv.workspaceId,
        workspaceName: ws.name,
        role: inv.role,
        createdAt: inv.createdAt,
        invitedByName: inviter?.name ?? inviter?.email ?? "Someone",
      });
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  },
});

export const myRoleInWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    try {
      const { role } = await requireWorkspaceAccess(ctx, workspaceId);
      return { role };
    } catch {
      return null;
    }
  },
});

export const inviteByEmail = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: roleValidator,
  },
  handler: async (ctx, { workspaceId, email: rawEmail, role }) => {
    const { userId, workspace } = await requireWorkspaceOwner(ctx, workspaceId);
    const email = normalizeEmail(rawEmail);
    if (!email) throw new Error("Email is required");

    const target = await findUserByEmailNormalized(ctx, rawEmail);

    if (!target) {
      throw new Error(
        "No Kruvan account exists for that email. They must sign up first.",
      );
    }

    if (target._id === userId) {
      throw new Error("You cannot invite yourself.");
    }

    if (workspace.ownerId === target._id) {
      throw new Error("That user is already the workspace owner.");
    }

    const existing = await ctx.db
      .query("workspaceUserMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", target._id),
      )
      .first();
    if (existing) {
      throw new Error("That user is already a member of this workspace.");
    }

    const allInvites = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const dup = allInvites.find(
      (i) => i.email === email && i.status === "pending",
    );
    if (dup) {
      throw new Error("An invitation is already pending for that email.");
    }

    return await ctx.db.insert("workspaceInvites", {
      workspaceId,
      email,
      invitedByUserId: userId,
      role,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const cancelInvite = mutation({
  args: { inviteId: v.id("workspaceInvites") },
  handler: async (ctx, { inviteId }) => {
    const inv = await ctx.db.get(inviteId);
    if (!inv) throw new Error("Invite not found");
    await requireWorkspaceAdminOrOwner(ctx, inv.workspaceId);
    if (inv.status !== "pending") {
      throw new Error("This invite is no longer pending.");
    }
    await ctx.db.patch(inviteId, { status: "cancelled" });
  },
});

export const acceptInvite = mutation({
  args: { inviteId: v.id("workspaceInvites") },
  handler: async (ctx, { inviteId }) => {
    const userId = await requireAuthUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user?.email) {
      throw new Error("Your account has no email; cannot accept invites.");
    }
    const email = normalizeEmail(user.email);

    const inv = await ctx.db.get(inviteId);
    if (!inv) throw new Error("Invite not found");
    if (inv.status !== "pending") {
      throw new Error("This invite is no longer pending.");
    }
    if (inv.email !== email) {
      throw new Error("This invitation was sent to a different email address.");
    }

    const existing = await ctx.db
      .query("workspaceUserMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", inv.workspaceId).eq("userId", userId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(inviteId, { status: "accepted" });
      await ensureWorkspaceAssigneeForUser(ctx, inv.workspaceId, userId);
      return { ok: true as const };
    }

    await ctx.db.insert("workspaceUserMemberships", {
      workspaceId: inv.workspaceId,
      userId,
      role: inv.role,
    });
    await ctx.db.patch(inviteId, { status: "accepted" });
    await ensureWorkspaceAssigneeForUser(ctx, inv.workspaceId, userId);
    return { ok: true as const };
  },
});

export const declineInvite = mutation({
  args: { inviteId: v.id("workspaceInvites") },
  handler: async (ctx, { inviteId }) => {
    const userId = await requireAuthUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user?.email) throw new Error("Your account has no email.");
    const email = normalizeEmail(user.email);

    const inv = await ctx.db.get(inviteId);
    if (!inv) throw new Error("Invite not found");
    if (inv.status !== "pending") {
      throw new Error("This invite is no longer pending.");
    }
    if (inv.email !== email) {
      throw new Error("This invitation was sent to a different email address.");
    }

    await ctx.db.patch(inviteId, { status: "declined" });
  },
});

export const removeMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, { workspaceId, targetUserId }) => {
    const { userId, role } = await requireWorkspaceAccess(ctx, workspaceId);
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    if (workspace.ownerId === targetUserId) {
      throw new Error("Cannot remove the workspace owner.");
    }

    const targetMembership = await ctx.db
      .query("workspaceUserMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", targetUserId),
      )
      .first();

    if (!targetMembership) {
      throw new Error("That user is not a workspace member.");
    }

    if (role === "member") {
      throw new Error("Forbidden");
    }

    if (role === "admin") {
      if (targetMembership.role === "admin") {
        throw new Error("Only the workspace owner can remove an admin.");
      }
    }

    if (targetUserId === userId) {
      throw new Error("Use leave workspace when available, or ask the owner to remove you.");
    }

    await ctx.db.delete(targetMembership._id);
    await removeWorkspaceAssigneeForUser(ctx, workspaceId, targetUserId);
  },
});

export const updateMemberRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.id("users"),
    role: roleValidator,
  },
  handler: async (ctx, { workspaceId, targetUserId, role }) => {
    const { workspace } = await requireWorkspaceOwner(ctx, workspaceId);
    if (workspace.ownerId === targetUserId) {
      throw new Error("The owner role cannot be changed.");
    }

    const membership = await ctx.db
      .query("workspaceUserMemberships")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", targetUserId),
      )
      .first();
    if (!membership) {
      throw new Error("That user is not a workspace member.");
    }

    await ctx.db.patch(membership._id, { role });
  },
});
