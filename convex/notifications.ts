import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./authHelpers";

function startOfDayUtc(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const dismissals = await ctx.db
      .query("notificationDismissals")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const dismissed = new Set(dismissals.map((d) => d.fingerprint));

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const now = Date.now();
    const sod = startOfDayUtc(now);
    const eod = sod + 86400000;

    const items: Array<{
      fingerprint: string;
      title: string;
      body: string;
      severity: "high" | "medium";
      link:
        | { to: "/tasks"; search: { task: string; taskView?: "list" | "board" } }
        | { to: "/projects"; search: { project: string } };
    }> = [];

    for (const t of tasks) {
      if (t.status === "done" || t.status === "cancelled") continue;
      if (t.dueDate === undefined) continue;
      const id = String(t._id);
      if (t.dueDate < sod) {
        const fingerprint = `task:${id}:overdue`;
        if (!dismissed.has(fingerprint)) {
          items.push({
            fingerprint,
            title: "Task overdue",
            body: t.title,
            severity: "high",
            link: { to: "/tasks", search: { task: id } },
          });
        }
      } else if (t.dueDate >= sod && t.dueDate < eod) {
        const fingerprint = `task:${id}:due_today`;
        if (!dismissed.has(fingerprint)) {
          items.push({
            fingerprint,
            title: "Due today",
            body: t.title,
            severity: "medium",
            link: { to: "/tasks", search: { task: id } },
          });
        }
      }
    }

    for (const p of projects) {
      if (p.status === "done") continue;
      if (p.dueDate === undefined) continue;
      if (p.dueDate >= sod) continue;
      const id = String(p._id);
      const fingerprint = `project:${id}:overdue`;
      if (!dismissed.has(fingerprint)) {
        items.push({
          fingerprint,
          title: "Project deadline passed",
          body: p.name,
          severity: "high",
          link: { to: "/projects", search: { project: id } },
        });
      }
    }

    items.sort((a, b) => {
      const order = { high: 0, medium: 1 };
      return order[a.severity] - order[b.severity];
    });

    return items;
  },
});

export const dismiss = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    fingerprint: v.string(),
  },
  handler: async (ctx, { workspaceId, fingerprint }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const existing = await ctx.db
      .query("notificationDismissals")
      .withIndex("by_workspace_fingerprint", (q) =>
        q.eq("workspaceId", workspaceId).eq("fingerprint", fingerprint),
      )
      .first();
    if (existing) return;
    await ctx.db.insert("notificationDismissals", {
      workspaceId,
      fingerprint,
    });
  },
});
