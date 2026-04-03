import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type DbCtx = QueryCtx | MutationCtx;

export type WorkspaceAuthRole = "owner" | "admin" | "member";

function isMutationCtx(ctx: DbCtx): ctx is MutationCtx {
  return "scheduler" in ctx;
}

export async function requireAuthUserId(ctx: DbCtx | ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

export async function requireWorkspaceAccess(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
): Promise<{
  userId: Id<"users">;
  workspace: Doc<"workspaces">;
  role: WorkspaceAuthRole;
}> {
  const userId = await requireAuthUserId(ctx);
  let workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw new Error("Workspace not found");

  if (workspace.ownerId === userId) {
    return { userId, workspace, role: "owner" };
  }

  const membership = await ctx.db
    .query("workspaceUserMemberships")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId),
    )
    .first();

  if (membership) {
    return {
      userId,
      workspace,
      role: membership.role,
    };
  }

  const ownerMissing =
    workspace.ownerId === undefined ||
    (await ctx.db.get(workspace.ownerId)) === null;

  if (ownerMissing) {
    if (isMutationCtx(ctx)) {
      await ctx.db.patch(workspaceId, { ownerId: userId });
      workspace = await ctx.db.get(workspaceId);
      if (!workspace) throw new Error("Workspace not found");
    }
    return { userId, workspace, role: "owner" };
  }

  throw new Error("Forbidden");
}

/** Workspace settings and collaboration management (not content-only members). */
export async function requireWorkspaceAdminOrOwner(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
) {
  const auth = await requireWorkspaceAccess(ctx, workspaceId);
  if (auth.role !== "owner" && auth.role !== "admin") {
    throw new Error("Forbidden");
  }
  return auth;
}

export async function requireWorkspaceOwner(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
) {
  const auth = await requireWorkspaceAccess(ctx, workspaceId);
  if (auth.role !== "owner") {
    throw new Error("Forbidden");
  }
  return auth;
}

export async function requireProjectAccess(ctx: DbCtx, projectId: Id<"projects">) {
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error("Project not found");
  await requireWorkspaceAccess(ctx, project.workspaceId);
  return project;
}

export async function requireTaskAccess(ctx: DbCtx, taskId: Id<"tasks">) {
  const task = await ctx.db.get(taskId);
  if (!task) throw new Error("Task not found");
  await requireWorkspaceAccess(ctx, task.workspaceId);
  return task;
}

export async function requireFolderAccess(ctx: DbCtx, folderId: Id<"folders">) {
  const folder = await ctx.db.get(folderId);
  if (!folder) throw new Error("Folder not found");
  await requireWorkspaceAccess(ctx, folder.workspaceId);
  return folder;
}

export async function requireTagAccess(ctx: DbCtx, tagId: Id<"tags">) {
  const tag = await ctx.db.get(tagId);
  if (!tag) throw new Error("Tag not found");
  await requireWorkspaceAccess(ctx, tag.workspaceId);
  return tag;
}

export async function requireNoteAccess(ctx: DbCtx, noteId: Id<"notes">) {
  const note = await ctx.db.get(noteId);
  if (!note) throw new Error("Note not found");
  await requireWorkspaceAccess(ctx, note.workspaceId);
  return note;
}

export async function requireEventAccess(ctx: DbCtx, eventId: Id<"events">) {
  const event = await ctx.db.get(eventId);
  if (!event) throw new Error("Event not found");
  await requireWorkspaceAccess(ctx, event.workspaceId);
  return event;
}

export async function requireContentPlanAccess(
  ctx: DbCtx,
  contentPlanId: Id<"contentPlans">,
) {
  const row = await ctx.db.get(contentPlanId);
  if (!row) throw new Error("Content plan not found");
  await requireWorkspaceAccess(ctx, row.workspaceId);
  return row;
}

export async function requireWorkspaceMemberAccess(
  ctx: DbCtx,
  memberId: Id<"workspaceMembers">,
) {
  const row = await ctx.db.get(memberId);
  if (!row) throw new Error("Member not found");
  await requireWorkspaceAccess(ctx, row.workspaceId);
  return row;
}

/** Ensures a project row belongs to the given workspace (prevents cross-workspace IDs). */
export async function assertProjectInWorkspace(
  ctx: DbCtx,
  projectId: Id<"projects">,
  workspaceId: Id<"workspaces">,
) {
  const p = await ctx.db.get(projectId);
  if (!p || p.workspaceId !== workspaceId) {
    throw new Error("Invalid project for this workspace");
  }
}

/** Ensures a folder row belongs to the given workspace. */
export async function assertFolderInWorkspace(
  ctx: DbCtx,
  folderId: Id<"folders">,
  workspaceId: Id<"workspaces">,
) {
  const f = await ctx.db.get(folderId);
  if (!f || f.workspaceId !== workspaceId) {
    throw new Error("Invalid folder for this workspace");
  }
}

/** Ensures a task-assignee roster row belongs to the given workspace. */
export async function assertWorkspaceMemberInWorkspace(
  ctx: DbCtx,
  memberId: Id<"workspaceMembers">,
  workspaceId: Id<"workspaces">,
) {
  const m = await ctx.db.get(memberId);
  if (!m || m.workspaceId !== workspaceId) {
    throw new Error("Invalid assignee for this workspace");
  }
}

/** Only participants can read or post in a direct message conversation. */
export async function requireDirectConversationAccess(
  ctx: DbCtx,
  conversationId: Id<"conversations">,
) {
  const userId = await requireAuthUserId(ctx);
  const conv = await ctx.db.get(conversationId);
  if (!conv || conv.kind !== "dm") throw new Error("Conversation not found");
  const participants = await ctx.db
    .query("conversationParticipants")
    .withIndex("by_conversation", (q) =>
      q.eq("conversationId", conversationId),
    )
    .collect();
  if (!participants.some((p) => p.userId === userId)) {
    throw new Error("Forbidden");
  }
  return { conversation: conv, userId, participants };
}
