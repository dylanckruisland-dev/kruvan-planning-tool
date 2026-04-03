import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAuthUserId, requireWorkspaceAccess } from "./authHelpers";

function startOfDayUtc(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const userId = await requireAuthUserId(ctx);

    const dismissals = await ctx.db
      .query("notificationDismissals")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const dismissed = new Set(dismissals.map((d) => d.fingerprint));

    const inboxRows = await ctx.db
      .query("userInboxNotifications")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", workspaceId),
      )
      .collect();
    const inboxActive = inboxRows.filter((r) => r.dismissedAt == null);

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
    const dayMs = 86400000;
    const daysFromTodayForDue = (dueMs: number) =>
      Math.round((startOfDayUtc(dueMs) - sod) / dayMs);

    const items: Array<{
      fingerprint: string;
      title: string;
      body: string;
      severity: "high" | "medium";
      dueUrgency: "critical" | "soon" | "later";
      link:
        | { to: "/tasks"; search: { task: string; taskView?: "list" | "board" } }
        | { to: "/projects"; search: { project: string } }
        | { to: "/messages"; search: { team: string } };
    }> = [];

    for (const row of inboxActive) {
      items.push({
        fingerprint: `inbox:${String(row._id)}`,
        title: row.title,
        body: row.body,
        severity: "high",
        dueUrgency: "critical",
        link: { to: "/messages", search: { team: String(workspaceId) } },
      });
    }

    const UPCOMING_DAYS_MAX = 14;

    for (const t of tasks) {
      if (t.status === "done" || t.status === "cancelled") continue;
      if (t.dueDate === undefined) continue;
      const id = String(t._id);
      const days = daysFromTodayForDue(t.dueDate);
      const dueDayStart = startOfDayUtc(t.dueDate);

      if (days < 0) {
        const fingerprint = `task:${id}:overdue`;
        if (!dismissed.has(fingerprint)) {
          items.push({
            fingerprint,
            title: "Task overdue",
            body: t.title,
            severity: "high",
            dueUrgency: "critical",
            link: { to: "/tasks", search: { task: id } },
          });
        }
      } else if (days === 0) {
        const fingerprint = `task:${id}:due_today`;
        if (!dismissed.has(fingerprint)) {
          items.push({
            fingerprint,
            title: "Due today",
            body: t.title,
            severity: "medium",
            dueUrgency: "critical",
            link: { to: "/tasks", search: { task: id } },
          });
        }
      } else if (days === 1) {
        const fingerprint = `task:${id}:due_tomorrow`;
        if (!dismissed.has(fingerprint)) {
          items.push({
            fingerprint,
            title: "Due tomorrow",
            body: t.title,
            severity: "medium",
            dueUrgency: "soon",
            link: { to: "/tasks", search: { task: id } },
          });
        }
      } else if (days >= 2 && days <= UPCOMING_DAYS_MAX) {
        const fingerprint = `task:${id}:upcoming:${dueDayStart}`;
        if (!dismissed.has(fingerprint)) {
          items.push({
            fingerprint,
            title: `Due in ${days} days`,
            body: t.title,
            severity: "medium",
            dueUrgency: "later",
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
          dueUrgency: "critical",
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
    const userId = await requireAuthUserId(ctx);

    if (fingerprint.startsWith("inbox:")) {
      const raw = fingerprint.slice("inbox:".length);
      const inboxId = raw as Id<"userInboxNotifications">;
      const row = await ctx.db.get(inboxId);
      if (
        row &&
        row.userId === userId &&
        row.workspaceId === workspaceId
      ) {
        await ctx.db.patch(inboxId, { dismissedAt: Date.now() });
      }
      return;
    }

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
