import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  requireAuthUserId,
  requireDirectConversationAccess,
  requireWorkspaceAccess,
} from "./authHelpers";

const MAX_BODY = 8000;
const DEFAULT_MSG_LIMIT = 500;

function dmPairKey(a: Id<"users">, b: Id<"users">): string {
  const a1 = String(a);
  const b1 = String(b);
  return a1 < b1 ? `${a1}|${b1}` : `${b1}|${a1}`;
}

function displayName(u: { name?: string; email?: string } | null) {
  if (!u) return "Member";
  return (
    u.name?.trim() || u.email?.split("@")[0]?.trim() || "Member"
  );
}

async function resolveMentionedUserIds(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  body: string,
): Promise<Id<"users">[]> {
  const re = /@([^\s@]+)/g;
  const matches = Array.from(body.matchAll(re));
  if (matches.length === 0) return [];
  const memberships = await ctx.db
    .query("workspaceUserMemberships")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const users: Doc<"users">[] = [];
  for (const m of memberships) {
    const u = await ctx.db.get(m.userId);
    if (u) users.push(u);
  }
  const ws = await ctx.db.get(workspaceId);
  if (ws?.ownerId) {
    const owner = await ctx.db.get(ws.ownerId);
    if (owner && !users.some((u) => u._id === owner._id)) {
      users.push(owner);
    }
  }
  const found = new Set<Id<"users">>();
  for (const match of matches) {
    const needle = match[1].toLowerCase();
    for (const u of users) {
      const name = (u.name || u.email?.split("@")[0] || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const localPart = email.split("@")[0] ?? "";
      if (
        name === needle ||
        name.startsWith(needle) ||
        email.startsWith(needle) ||
        localPart === needle
      ) {
        found.add(u._id);
      }
    }
  }
  return Array.from(found);
}

export const searchUsers = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query: searchQuery, limit }) => {
    const userId = await requireAuthUserId(ctx);
    const trimmed = searchQuery.trim().toLowerCase();
    if (trimmed.length < 2) return [];
    const cap = Math.min(limit ?? 25, 50);
    const all = await ctx.db.query("users").collect();
    const filtered = all.filter(
      (u) =>
        u._id !== userId &&
        (u.name?.toLowerCase().includes(trimmed) ||
          (u.email?.toLowerCase().includes(trimmed) ?? false)),
    );
    filtered.sort((a, b) => {
      const an = a.name ?? a.email ?? "";
      const bn = b.name ?? b.email ?? "";
      return an.localeCompare(bn);
    });
    return filtered.slice(0, cap).map((u) => ({
      userId: u._id,
      name: displayName(u),
      email: u.email ?? null,
      image: u.image ?? null,
    }));
  },
});

export const listConversations = query({
  args: v.object({}),
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const myRows = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const out: Array<{
      conversationId: Id<"conversations">;
      otherUserId: Id<"users">;
      otherName: string;
      otherImage: string | null;
      lastMessageAt: number;
      preview: string;
    }> = [];

    for (const row of myRows) {
      const conv = await ctx.db.get(row.conversationId);
      if (!conv || conv.kind !== "dm") continue;
      const parts = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conv._id),
        )
        .collect();
      const other = parts.find((p) => p.userId !== userId);
      if (!other) continue;
      const otherUser = await ctx.db.get(other.userId);
      out.push({
        conversationId: conv._id,
        otherUserId: other.userId,
        otherName: displayName(otherUser),
        otherImage: otherUser?.image ?? null,
        lastMessageAt: conv.lastMessageAt,
        preview: conv.lastMessageBody ?? "",
      });
    }

    out.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return out;
  },
});

export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const { userId, participants } = await requireDirectConversationAccess(
      ctx,
      conversationId,
    );
    const other = participants.find((p) => p.userId !== userId);
    if (!other) return null;
    const otherUser = await ctx.db.get(other.userId);
    return {
      conversationId,
      otherUserId: other.userId,
      otherName: displayName(otherUser),
      otherImage: otherUser?.image ?? null,
    };
  },
});

export const listMessages = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { conversationId, limit }) => {
    await requireDirectConversationAccess(ctx, conversationId);
    const cap = Math.min(Math.max(limit ?? DEFAULT_MSG_LIMIT, 1), 1000);
    const rows = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", conversationId),
      )
      .collect();
    const sliced = rows.length > cap ? rows.slice(-cap) : rows;
    return Promise.all(
      sliced.map(async (m) => {
        const u = await ctx.db.get(m.senderId);
        return {
          _id: m._id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          body: m.body,
          createdAt: m.createdAt,
          senderName: displayName(u),
          senderImage: u?.image ?? null,
        };
      }),
    );
  },
});

export const getOrCreateConversation = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const userId = await requireAuthUserId(ctx);
    if (otherUserId === userId) throw new Error("Cannot chat with yourself");
    const other = await ctx.db.get(otherUserId);
    if (!other) throw new Error("User not found");

    const key = dmPairKey(userId, otherUserId);
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_dm_pair", (q) => q.eq("dmPairKey", key))
      .first();
    if (existing) {
      return { conversationId: existing._id };
    }

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      kind: "dm",
      dmPairKey: key,
      createdAt: now,
      lastMessageAt: now,
    });
    await ctx.db.insert("conversationParticipants", {
      conversationId,
      userId,
    });
    await ctx.db.insert("conversationParticipants", {
      conversationId,
      userId: otherUserId,
    });
    return { conversationId };
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, { conversationId, body }) => {
    await requireDirectConversationAccess(ctx, conversationId);
    const senderId = await requireAuthUserId(ctx);
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message cannot be empty");
    if (trimmed.length > MAX_BODY) throw new Error("Message is too long");
    const now = Date.now();
    await ctx.db.insert("directMessages", {
      conversationId,
      senderId,
      body: trimmed,
      createdAt: now,
    });
    const preview =
      trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessageBody: preview,
    });
    return { ok: true as const };
  },
});

export const listWorkspaceTeamMessages = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, limit }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const cap = Math.min(Math.max(limit ?? DEFAULT_MSG_LIMIT, 1), 1000);
    const rows = await ctx.db
      .query("workspaceMessages")
      .withIndex("by_workspace_created", (q) =>
        q.eq("workspaceId", workspaceId),
      )
      .collect();
    const sliced = rows.length > cap ? rows.slice(-cap) : rows;
    return Promise.all(
      sliced.map(async (m) => {
        const u = await ctx.db.get(m.senderId);
        return {
          _id: m._id,
          workspaceId: m.workspaceId,
          senderId: m.senderId,
          body: m.body,
          createdAt: m.createdAt,
          senderName: displayName(u),
          senderImage: u?.image ?? null,
        };
      }),
    );
  },
});

export const sendWorkspaceTeamMessage = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    body: v.string(),
  },
  handler: async (ctx, { workspaceId, body }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const senderId = await requireAuthUserId(ctx);
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Message cannot be empty");
    if (trimmed.length > MAX_BODY) throw new Error("Message is too long");
    const now = Date.now();
    const mentioned = await resolveMentionedUserIds(ctx, workspaceId, trimmed);
    const messageId = await ctx.db.insert("workspaceMessages", {
      workspaceId,
      senderId,
      body: trimmed,
      createdAt: now,
      mentionedUserIds: mentioned.length > 0 ? mentioned : undefined,
    });
    const sender = await ctx.db.get(senderId);
    const senderName =
      sender?.name?.trim() ||
      sender?.email?.split("@")[0]?.trim() ||
      "Someone";
    for (const uid of mentioned) {
      if (uid === senderId) continue;
      await ctx.db.insert("userInboxNotifications", {
        userId: uid,
        workspaceId,
        kind: "team_mention",
        title: `${senderName} mentioned you in Team`,
        body:
          trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed,
        messageId,
        fromUserId: senderId,
        createdAt: now,
      });
    }
    const preview =
      trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
    await ctx.db.patch(workspaceId, {
      teamChatLastAt: now,
      teamChatPreview: preview,
    });
    return { ok: true as const };
  },
});
