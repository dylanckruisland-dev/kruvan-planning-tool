import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Deletes all tasks, events, notes, projects, tags, folders, workspace members,
 * and notification dismissals. Preserves `users` and `workspaces`.
 *
 * Run: `npx convex run migrations:clearAllUserContent '{"confirm":"DELETE_ALL"}'`
 */
export const clearAllUserContent = mutation({
  args: { confirm: v.literal("DELETE_ALL") },
  handler: async (ctx) => {
    const deleted: Record<string, number> = {};

    const delTable = async (
      table:
        | "events"
        | "tasks"
        | "notes"
        | "contentPlans"
        | "projects"
        | "notificationDismissals"
        | "tags"
        | "workspaceMembers"
        | "folders",
    ) => {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      deleted[table] = rows.length;
    };

    await delTable("events");
    await delTable("tasks");
    await delTable("notes");
    await delTable("contentPlans");
    await delTable("projects");
    await delTable("notificationDismissals");
    await delTable("tags");
    await delTable("workspaceMembers");
    await delTable("folders");

    return { deleted, message: "users and workspaces were not modified." };
  },
});

/**
 * Maps legacy `tasks.assigneeId` (users) to `assigneeMemberId` by matching user name
 * to a workspace member in the same workspace, then removes `assigneeId`.
 * Run once: `npx convex run migrations:migrateTaskAssigneesToWorkspaceMembers`
 */
export const migrateTaskAssigneesToWorkspaceMembers = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("tasks").collect();
    let migrated = 0;
    for (const t of rows) {
      const doc = t as Record<string, unknown>;
      const legacy = doc.assigneeId;
      if (legacy === undefined) continue;
      const user = await ctx.db.get(legacy as Id<"users">);
      const members = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", t.workspaceId))
        .collect();
      const name = user?.name;
      const member =
        name !== undefined
          ? members.find((m) => m.name === name)
          : undefined;
      await ctx.db.patch(t._id, {
        assigneeMemberId: member?._id ?? undefined,
        assigneeId: undefined,
      } as never);
      migrated += 1;
    }
    return { tasksMigrated: migrated };
  },
});

/**
 * One-time cleanup for databases created before the folders refactor.
 * Run: `npx convex run migrations:stripLegacyFields`
 */
export const stripLegacyFields = mutation({
  args: {},
  handler: async (ctx) => {
    let projects = 0;
    let notes = 0;
    let tasks = 0;

    const projectRows = await ctx.db.query("projects").collect();
    for (const p of projectRows) {
      const doc = p as Record<string, unknown>;
      if (doc.collectionId !== undefined) {
        // Legacy field not in current schema; `any` keeps tsc happy.
        await ctx.db.patch(p._id, { collectionId: undefined } as never);
        projects += 1;
      }
    }

    const noteRows = await ctx.db.query("notes").collect();
    for (const n of noteRows) {
      const doc = n as Record<string, unknown>;
      if (doc.collectionId !== undefined) {
        await ctx.db.patch(n._id, { collectionId: undefined } as never);
        notes += 1;
      }
    }

    const taskRows = await ctx.db.query("tasks").collect();
    for (const t of taskRows) {
      const doc = t as Record<string, unknown>;
      if (doc.showInAgenda !== undefined) {
        await ctx.db.patch(t._id, { showInAgenda: undefined } as never);
        tasks += 1;
      }
    }

    return { projects, notes, tasks };
  },
});
