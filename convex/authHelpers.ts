import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type DbCtx = QueryCtx | MutationCtx;

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
) {
  const userId = await requireAuthUserId(ctx);
  let workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw new Error("Workspace not found");

  if (workspace.ownerId === userId) {
    return { userId, workspace };
  }

  const ownerMissing =
    workspace.ownerId === undefined ||
    (await ctx.db.get(workspace.ownerId)) === null;

  if (ownerMissing) {
    // Mutations can claim; queries are read-only (no patch) but still allow access.
    if (isMutationCtx(ctx)) {
      await ctx.db.patch(workspaceId, { ownerId: userId });
      workspace = await ctx.db.get(workspaceId);
      if (!workspace) throw new Error("Workspace not found");
    }
    return { userId, workspace };
  }

  throw new Error("Forbidden");
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
