import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireAuthUserId,
  requireWorkspaceAccess,
  requireWorkspaceAdminOrOwner,
} from "./authHelpers";
import { ensureWorkspaceAssigneeForUser } from "./workspaceMembers";

/** Maximum workspaces a user may own (not counting memberships on others’ workspaces). */
export const MAX_OWNED_WORKSPACES = 3;

export const ownedWorkspaceStats = query({
  args: v.object({}),
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const owned = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return {
      ownedCount: owned.length,
      maxOwned: MAX_OWNED_WORKSPACES,
      canCreate: owned.length < MAX_OWNED_WORKSPACES,
    };
  },
});

export const list = query({
  args: v.object({}),
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const owned = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const ownedIds = new Set(owned.map((w) => w._id));

    const membershipRows = await ctx.db
      .query("workspaceUserMemberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const shared: typeof owned = [];
    for (const row of membershipRows) {
      if (ownedIds.has(row.workspaceId)) continue;
      const w = await ctx.db.get(row.workspaceId);
      if (w) shared.push(w);
    }
    const sharedIds = new Set(shared.map((w) => w._id));

    // Legacy: no owner, or owner user doc removed (e.g. after auth migration) — show so user can open / claim via mutations.
    const extra: typeof owned = [];
    for (const w of await ctx.db.query("workspaces").collect()) {
      if (ownedIds.has(w._id) || sharedIds.has(w._id)) continue;
      if (w.ownerId === undefined) {
        extra.push(w);
        continue;
      }
      if ((await ctx.db.get(w.ownerId)) === null) {
        extra.push(w);
      }
    }
    return [...owned, ...shared, ...extra];
  },
});

const landingRouteValidator = v.union(
  v.literal("/"),
  v.literal("/agenda"),
  v.literal("/tasks"),
  v.literal("/notes"),
  v.literal("/content"),
  v.literal("/projects"),
  v.literal("/settings"),
  v.literal("/messages"),
);

function slugifyBase(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s.length > 0 ? s.slice(0, 48) : "workspace";
}

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireAuthUserId(ctx);
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new Error("Name cannot be empty");

    const alreadyOwned = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    if (alreadyOwned.length >= MAX_OWNED_WORKSPACES) {
      throw new Error(
        "You can create up to 3 workspaces per account. You can still join workspaces others invite you to.",
      );
    }

    let slug = `${slugifyBase(trimmed)}-${Date.now().toString(36)}`;
    for (let i = 0; i < 8; i++) {
      const existing = await ctx.db
        .query("workspaces")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!existing) break;
      slug = `${slugifyBase(trimmed)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    const workspaceId = await ctx.db.insert("workspaces", {
      name: trimmed,
      slug,
      ownerId: userId,
      accent: "#4f46e5",
    });
    await ensureWorkspaceAssigneeForUser(ctx, workspaceId, userId);
    return { workspaceId };
  },
});

export const get = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    return await ctx.db.get(workspaceId);
  },
});

export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    accent: v.optional(v.union(v.string(), v.null())),
    defaultAgendaView: v.optional(
      v.union(v.literal("week"), v.literal("day"), v.null()),
    ),
    defaultTaskView: v.optional(
      v.union(v.literal("list"), v.literal("board"), v.null()),
    ),
    defaultLandingRoute: v.optional(
      v.union(landingRouteValidator, v.null()),
    ),
    timezone: v.optional(v.union(v.string(), v.null())),
    timeFormat: v.optional(
      v.union(v.literal("12"), v.literal("24"), v.null()),
    ),
    weekStartsOn: v.optional(
      v.union(v.literal("sunday"), v.literal("monday"), v.null()),
    ),
  },
  handler: async (ctx, args) => {
    const { workspaceId, ...rest } = args;
    await requireWorkspaceAdminOrOwner(ctx, workspaceId);
    const existing = await ctx.db.get(workspaceId);
    if (!existing) throw new Error("Workspace not found");

    const patch: Record<string, unknown> = {};
    if (rest.name !== undefined) {
      const n = rest.name.trim();
      if (n.length === 0) throw new Error("Name cannot be empty");
      patch.name = n;
    }
    if (rest.accent !== undefined) {
      patch.accent = rest.accent === null ? undefined : rest.accent;
    }
    if (rest.defaultAgendaView !== undefined) {
      patch.defaultAgendaView =
        rest.defaultAgendaView === null ? undefined : rest.defaultAgendaView;
    }
    if (rest.defaultTaskView !== undefined) {
      patch.defaultTaskView =
        rest.defaultTaskView === null ? undefined : rest.defaultTaskView;
    }
    if (rest.defaultLandingRoute !== undefined) {
      patch.defaultLandingRoute =
        rest.defaultLandingRoute === null ? undefined : rest.defaultLandingRoute;
    }
    if (rest.timezone !== undefined) {
      patch.timezone = rest.timezone === null ? undefined : rest.timezone;
    }
    if (rest.timeFormat !== undefined) {
      patch.timeFormat =
        rest.timeFormat === null ? undefined : rest.timeFormat;
    }
    if (rest.weekStartsOn !== undefined) {
      patch.weekStartsOn =
        rest.weekStartsOn === null ? undefined : rest.weekStartsOn;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(workspaceId, patch);
    }
    return { ok: true as const };
  },
});
