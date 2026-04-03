import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  assertProjectInWorkspace,
  requireAuthUserId,
  requireContentPlanAccess,
  requireWorkspaceAccess,
} from "./authHelpers";

const platform = v.union(
  v.literal("instagram"),
  v.literal("tiktok"),
  v.literal("youtube"),
  v.literal("x"),
  v.literal("linkedin"),
  v.literal("threads"),
  v.literal("other"),
);

const status = v.union(
  v.literal("idea"),
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("published"),
  v.literal("skipped"),
);

const attachment = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.optional(v.string()),
});

const MAX_CUSTOM_PLATFORMS = 12;
const MAX_CUSTOM_PLATFORM_LEN = 40;

function normalizeCustomPlatforms(
  input: string[] | undefined | null,
): string[] | undefined {
  if (!input?.length) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    const t = item.trim();
    if (!t || t.length > MAX_CUSTOM_PLATFORM_LEN) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_CUSTOM_PLATFORMS) break;
  }
  return out.length ? out : undefined;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Resolve public URLs for stored files (for previews in the client). */
export const getAttachmentUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, { storageIds }) => {
    await requireAuthUserId(ctx);
    const out: { storageId: (typeof storageIds)[number]; url: string | null }[] =
      [];
    for (const storageId of storageIds) {
      const url = await ctx.storage.getUrl(storageId);
      out.push({ storageId, url });
    }
    return out;
  },
});

export const deleteStoredFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireAuthUserId(ctx);
    await ctx.storage.delete(storageId);
  },
});

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    status: v.optional(status),
    platform: v.optional(platform),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    let rows = await ctx.db
      .query("contentPlans")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (args.projectId) {
      rows = rows.filter((r) => r.projectId === args.projectId);
    }
    if (args.status) {
      rows = rows.filter((r) => r.status === args.status);
    }
    if (args.platform) {
      rows = rows.filter((r) => r.platforms.includes(args.platform!));
    }
    if (args.search && args.search.trim()) {
      const q = args.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.notes?.toLowerCase().includes(q) ?? false) ||
          (r.contentFormat?.toLowerCase().includes(q) ?? false) ||
          (r.attachments?.some((a) => a.name.toLowerCase().includes(q)) ??
            false) ||
          (r.customPlatforms?.some((c) =>
            c.toLowerCase().includes(q),
          ) ??
            false),
      );
    }
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return rows;
  },
});

/** Content items with a scheduled time in [start, end) — for the content calendar. */
export const listScheduledInRange = query({
  args: {
    workspaceId: v.id("workspaces"),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, { workspaceId, start, end }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const rows = await ctx.db
      .query("contentPlans")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    return rows.filter(
      (r) =>
        r.scheduledFor != null &&
        r.scheduledFor >= start &&
        r.scheduledFor < end,
    );
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    notes: v.optional(v.string()),
    contentFormat: v.optional(v.string()),
    platforms: v.array(platform),
    customPlatforms: v.optional(v.array(v.string())),
    status,
    scheduledFor: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    attachments: v.optional(v.array(attachment)),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const now = Date.now();
    const title = args.title.trim();
    if (!title) throw new Error("Title is required");
    const attachments =
      args.attachments?.length ? args.attachments : undefined;
    if (args.projectId) {
      await assertProjectInWorkspace(ctx, args.projectId, args.workspaceId);
    }
    const customNorm = normalizeCustomPlatforms(args.customPlatforms);
    const platforms: typeof args.platforms = args.platforms.length
      ? args.platforms
      : customNorm?.length
        ? ([] as typeof args.platforms)
        : (["other"] as typeof args.platforms);
    return await ctx.db.insert("contentPlans", {
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      title,
      notes: args.notes?.trim() || undefined,
      contentFormat: args.contentFormat?.trim() || undefined,
      platforms,
      customPlatforms: customNorm,
      status: args.status,
      scheduledFor: args.scheduledFor,
      publishedAt: args.publishedAt,
      attachments,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    contentPlanId: v.id("contentPlans"),
    title: v.optional(v.string()),
    notes: v.optional(v.union(v.string(), v.null())),
    contentFormat: v.optional(v.union(v.string(), v.null())),
    platforms: v.optional(v.array(platform)),
    customPlatforms: v.optional(v.array(v.string())),
    status: v.optional(status),
    scheduledFor: v.optional(v.union(v.number(), v.null())),
    publishedAt: v.optional(v.union(v.number(), v.null())),
    attachments: v.optional(v.array(attachment)),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
  },
  handler: async (ctx, { contentPlanId, ...rest }) => {
    const doc = await requireContentPlanAccess(ctx, contentPlanId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (rest.title !== undefined) {
      const t = rest.title.trim();
      if (!t) throw new Error("Title cannot be empty");
      patch.title = t;
    }
    if (rest.notes !== undefined) {
      patch.notes =
        rest.notes === null ? undefined : rest.notes.trim() || undefined;
    }
    if (rest.contentFormat !== undefined) {
      patch.contentFormat =
        rest.contentFormat === null
          ? undefined
          : rest.contentFormat.trim() || undefined;
    }
    if (rest.platforms !== undefined || rest.customPlatforms !== undefined) {
      const preset = rest.platforms ?? doc.platforms ?? [];
      const customRaw =
        rest.customPlatforms !== undefined
          ? rest.customPlatforms
          : doc.customPlatforms;
      const customNorm = normalizeCustomPlatforms(customRaw ?? undefined);
      let nextPreset = [...preset];
      if (!nextPreset.length && !customNorm?.length) {
        nextPreset = ["other"];
      }
      patch.platforms = nextPreset;
      patch.customPlatforms = customNorm;
    }
    if (rest.status !== undefined) patch.status = rest.status;
    if (rest.projectId !== undefined) {
      if (rest.projectId !== null) {
        await assertProjectInWorkspace(ctx, rest.projectId, doc.workspaceId);
      }
      patch.projectId = rest.projectId ?? undefined;
    }
    if (rest.scheduledFor !== undefined) {
      patch.scheduledFor =
        rest.scheduledFor === null ? undefined : rest.scheduledFor;
    }
    if (rest.publishedAt !== undefined) {
      patch.publishedAt =
        rest.publishedAt === null ? undefined : rest.publishedAt;
    }
    if (rest.attachments !== undefined) {
      const existing = await ctx.db.get(contentPlanId);
      const oldIds = new Set(
        (existing?.attachments ?? []).map((a) => a.storageId),
      );
      const newIds = new Set(rest.attachments.map((a) => a.storageId));
      for (const id of Array.from(oldIds)) {
        if (!newIds.has(id)) {
          await ctx.storage.delete(id);
        }
      }
      patch.attachments =
        rest.attachments.length > 0 ? rest.attachments : undefined;
    }
    await ctx.db.patch(contentPlanId, patch);
  },
});

export const remove = mutation({
  args: { contentPlanId: v.id("contentPlans") },
  handler: async (ctx, { contentPlanId }) => {
    const doc = await requireContentPlanAccess(ctx, contentPlanId);
    if (doc?.attachments?.length) {
      for (const a of doc.attachments) {
        await ctx.storage.delete(a.storageId);
      }
    }
    await ctx.db.delete(contentPlanId);
  },
});
