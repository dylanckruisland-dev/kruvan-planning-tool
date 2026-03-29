import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

/** Demo data for the signed-in user’s workspace (optional). */
export const seedDemo = mutation({
  args: v.object({}),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const slug = "kruvan-demo";
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      if (existing.ownerId !== userId) throw new Error("Forbidden");
      return { workspaceId: existing._id, seeded: false as const };
    }

    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Kruvan Studio",
      slug,
      ownerId: userId,
      accent: "#4f46e5",
    });

    const m1 = await ctx.db.insert("workspaceMembers", {
      workspaceId,
      name: "Maya Chen",
      email: "maya@example.com",
    });
    const m2 = await ctx.db.insert("workspaceMembers", {
      workspaceId,
      name: "Jordan Blake",
      email: "jordan@example.com",
    });
    const m3 = await ctx.db.insert("workspaceMembers", {
      workspaceId,
      name: "Sam Rivera",
      email: "sam@example.com",
    });

    const tagDesign = await ctx.db.insert("tags", {
      workspaceId,
      name: "Design",
      color: "#a855f7",
    });
    const tagEng = await ctx.db.insert("tags", {
      workspaceId,
      name: "Engineering",
      color: "#3b82f6",
    });
    const tagOps = await ctx.db.insert("tags", {
      workspaceId,
      name: "Operations",
      color: "#14b8a6",
    });
    const tagClient = await ctx.db.insert("tags", {
      workspaceId,
      name: "Client",
      color: "#f97316",
    });

    const folderWork = await ctx.db.insert("folders", {
      workspaceId,
      name: "Work",
      parentId: undefined,
      sortOrder: 0,
    });
    const folderPersonal = await ctx.db.insert("folders", {
      workspaceId,
      name: "Personal",
      parentId: undefined,
      sortOrder: 1,
    });
    await ctx.db.insert("folders", {
      workspaceId,
      name: "School",
      parentId: undefined,
      sortOrder: 2,
    });
    const folderClientPrograms = await ctx.db.insert("folders", {
      workspaceId,
      name: "Client programs",
      parentId: folderWork,
      sortOrder: 0,
    });

    const now = Date.now();
    const day = 86400000;

    const p1 = await ctx.db.insert("projects", {
      workspaceId,
      folderId: folderWork,
      name: "Atlas CRM refresh",
      description: "Navigation, pipeline stages, and reporting widgets.",
      status: "active",
      priority: "high",
      dueDate: now + 12 * day,
      progress: 62,
      tagIds: [tagDesign, tagEng],
    });
    const p2 = await ctx.db.insert("projects", {
      workspaceId,
      folderId: folderClientPrograms,
      name: "Northwind rollout",
      description: "Phased onboarding with training sessions.",
      status: "active",
      priority: "urgent",
      dueDate: now + 5 * day,
      progress: 38,
      tagIds: [tagClient, tagOps],
    });
    await ctx.db.insert("projects", {
      workspaceId,
      name: "Internal analytics",
      description: "Warehouse metrics and team velocity dashboards.",
      status: "planning",
      priority: "medium",
      dueDate: now + 30 * day,
      progress: 12,
      tagIds: [tagEng],
    });

    const morning = new Date();
    morning.setHours(9, 0, 0, 0);
    const afternoon = new Date();
    afternoon.setHours(14, 30, 0, 0);

    const t1 = await ctx.db.insert("tasks", {
      workspaceId,
      projectId: p1,
      title: "Finalize sidebar IA",
      description: "Map IA to new information architecture doc.",
      dueDate: now + 1 * day,
      scheduledStart: morning.getTime(),
      scheduledEnd: morning.getTime() + 60 * 60 * 1000,
      status: "in_progress",
      priority: "high",
      assigneeMemberId: m1,
      labelIds: [tagDesign],
      subtasks: [
        {
          id: "seed-st-1",
          title: "Review current nav tree",
          done: true,
        },
        {
          id: "seed-st-2",
          title: "Align with IA doc v2",
          done: false,
        },
        {
          id: "seed-st-3",
          title: "Share with design for sign-off",
          done: false,
        },
      ],
    });
    await ctx.db.insert("tasks", {
      workspaceId,
      projectId: p1,
      title: "Ship dark mode tokens",
      dueDate: now + 3 * day,
      status: "todo",
      priority: "medium",
      assigneeMemberId: m2,
      labelIds: [tagDesign, tagEng],
    });
    await ctx.db.insert("tasks", {
      workspaceId,
      projectId: p2,
      title: "Dry-run cutover checklist",
      dueDate: now + 2 * day,
      status: "todo",
      priority: "urgent",
      assigneeMemberId: m3,
      labelIds: [tagOps],
    });
    await ctx.db.insert("tasks", {
      workspaceId,
      projectId: p2,
      title: "Executive readout deck",
      dueDate: now + 4 * day,
      status: "todo",
      priority: "high",
      assigneeMemberId: m1,
      labelIds: [tagClient],
    });
    await ctx.db.insert("tasks", {
      workspaceId,
      title: "Weekly planning block",
      description: "Personal focus time — no meetings.",
      dueDate: now + 6 * day,
      status: "todo",
      priority: "low",
      assigneeMemberId: m2,
      labelIds: [],
    });

    await ctx.db.insert("events", {
      workspaceId,
      title: "Design critique",
      description: "Atlas CRM navigation flows",
      startTime: morning.getTime(),
      endTime: morning.getTime() + 60 * 60 * 1000,
      projectId: p1,
      allDay: false,
    });
    await ctx.db.insert("events", {
      workspaceId,
      title: "Client steering",
      description: "Northwind rollout checkpoint",
      startTime: afternoon.getTime(),
      endTime: afternoon.getTime() + 45 * 60 * 1000,
      projectId: p2,
      allDay: false,
    });
    await ctx.db.insert("events", {
      workspaceId,
      title: "Team planning",
      startTime: morning.getTime() + 3 * day,
      endTime: morning.getTime() + 3 * day + 60 * 60 * 1000,
      taskId: t1,
      allDay: false,
    });

    await ctx.db.insert("notes", {
      workspaceId,
      projectId: p1,
      folderId: folderWork,
      title: "Navigation principles",
      body: "Keep wayfinding to three levels max. Prefer persistent left rail with contextual tabs.",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("notes", {
      workspaceId,
      projectId: p2,
      title: "Rollout risks",
      body: "Data migration window is tight. Confirm rollback script and support rota.",
      createdAt: now - day,
      updatedAt: now - day,
    });
    await ctx.db.insert("notes", {
      workspaceId,
      folderId: folderPersonal,
      title: "Weekly retro",
      body: "What went well: async updates. Improve: earlier stakeholder reviews.",
      createdAt: now - 2 * day,
      updatedAt: now - 2 * day,
    });

    return { workspaceId, seeded: true as const };
  },
});
