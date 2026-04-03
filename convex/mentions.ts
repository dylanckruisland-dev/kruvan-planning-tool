import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./authHelpers";

type Match = { ok: boolean; score: number };

function matchLabel(label: string, q: string): Match {
  const l = label.toLowerCase();
  if (!q) return { ok: true, score: 0 };
  if (l.startsWith(q)) return { ok: true, score: 100 };
  if (l.includes(q)) return { ok: true, score: 50 };
  return { ok: false, score: 0 };
}

type Item = {
  kind: string;
  id: string;
  label: string;
  sublabel?: string;
  score: number;
};

type Group = {
  kind: string;
  items: Array<Omit<Item, "score">>;
};

function topMatches(
  items: Item[],
  perType: number,
): Array<Omit<Item, "score">> {
  items.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.label.localeCompare(b.label);
  });
  return items.slice(0, perType).map(({ score: _s, ...rest }) => rest);
}

export const search = query({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    /** Max items per entity type (capped server-side). */
    perTypeLimit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, query: qRaw, perTypeLimit }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const perType = Math.min(Math.max(perTypeLimit ?? 8, 4), 12);
    const q = qRaw.trim().toLowerCase().slice(0, 80);

    const groups: Group[] = [];

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q2) => q2.eq("workspaceId", workspaceId))
      .collect();
    const taskItems: Item[] = [];
    for (const t of tasks) {
      const m = matchLabel(t.title, q);
      if (!m.ok) continue;
      taskItems.push({
        kind: "task",
        id: t._id,
        label: t.title,
        sublabel: "Task",
        score: m.score,
      });
    }
    const taskTop = topMatches(taskItems, perType);
    if (taskTop.length) groups.push({ kind: "task", items: taskTop });

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_workspace", (q2) => q2.eq("workspaceId", workspaceId))
      .collect();
    const noteItems: Item[] = [];
    for (const n of notes) {
      const m = matchLabel(n.title, q);
      if (!m.ok) continue;
      noteItems.push({
        kind: "note",
        id: n._id,
        label: n.title,
        sublabel: "Note",
        score: m.score,
      });
    }
    const noteTop = topMatches(noteItems, perType);
    if (noteTop.length) groups.push({ kind: "note", items: noteTop });

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q2) => q2.eq("workspaceId", workspaceId))
      .collect();
    const projectItems: Item[] = [];
    for (const p of projects) {
      const m = matchLabel(p.name, q);
      if (!m.ok) continue;
      projectItems.push({
        kind: "project",
        id: p._id,
        label: p.name,
        sublabel: "Project",
        score: m.score,
      });
    }
    const projectTop = topMatches(projectItems, perType);
    if (projectTop.length) groups.push({ kind: "project", items: projectTop });

    const events = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q2) => q2.eq("workspaceId", workspaceId))
      .collect();
    const eventItems: Item[] = [];
    for (const e of events) {
      const m = matchLabel(e.title, q);
      if (!m.ok) continue;
      eventItems.push({
        kind: "event",
        id: e._id,
        label: e.title,
        sublabel: "Event",
        score: m.score,
      });
    }
    const eventTop = topMatches(eventItems, perType);
    if (eventTop.length) groups.push({ kind: "event", items: eventTop });

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q2) => q2.eq("workspaceId", workspaceId))
      .collect();
    const memberItems: Item[] = [];
    for (const mem of members) {
      const m = matchLabel(mem.name, q);
      if (!m.ok) continue;
      memberItems.push({
        kind: "assignee",
        id: mem._id,
        label: mem.name,
        sublabel: mem.email ? `Assignee · ${mem.email}` : "Assignee",
        score: m.score,
      });
    }
    const memberTop = topMatches(memberItems, perType);
    if (memberTop.length) groups.push({ kind: "assignee", items: memberTop });

    const contentPlans = await ctx.db
      .query("contentPlans")
      .withIndex("by_workspace", (q2) => q2.eq("workspaceId", workspaceId))
      .collect();
    const contentItems: Item[] = [];
    for (const c of contentPlans) {
      const m = matchLabel(c.title, q);
      if (!m.ok) continue;
      contentItems.push({
        kind: "content",
        id: c._id,
        label: c.title,
        sublabel: "Content",
        score: m.score,
      });
    }
    const contentTop = topMatches(contentItems, perType);
    if (contentTop.length) groups.push({ kind: "content", items: contentTop });

    return { groups };
  },
});
