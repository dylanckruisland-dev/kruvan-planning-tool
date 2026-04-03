import ICAL from "ical.js";
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireWorkspaceAccess } from "./authHelpers";

const SYNC_RANGE_PAST_MS = 366 * 24 * 60 * 60 * 1000;
const SYNC_RANGE_FUTURE_MS = 366 * 2 * 24 * 60 * 60 * 1000;
const MAX_OCCURRENCES_PER_VEVENT = 512;

/** Apple/iCloud and some hosts reject generic bots; published feeds expect browser-like GETs. */
const ICS_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  Accept: "text/calendar,text/x-vcalendar;q=0.9,text/plain;q=0.8,*/*;q=0.5",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

function responseLooksLikeIcs(body: string): boolean {
  return /BEGIN:VCALENDAR/i.test(body);
}

function normalizeIcsUrl(raw: string): string {
  const t = raw.trim();
  if (t.toLowerCase().startsWith("webcal://")) {
    return "https://" + t.slice("webcal://".length);
  }
  return t;
}

function assertHttpUrl(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("Invalid calendar URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Calendar URL must be http(s)");
  }
}

type ParsedOccurrence = {
  instanceKey: string;
  icalUid: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  allDay: boolean;
};

function parseIcsToOccurrences(icsText: string, now: number): ParsedOccurrence[] {
  const rangeStart = now - SYNC_RANGE_PAST_MS;
  const rangeEnd = now + SYNC_RANGE_FUTURE_MS;
  let jcal: string | unknown[];
  try {
    jcal = ICAL.parse(icsText);
  } catch {
    return [];
  }
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");
  const out: ParsedOccurrence[] = [];
  const seen = new Set<string>();

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);
    if (event.isRecurrenceException()) continue;

    const uid = event.uid?.trim() || `noid-${out.length}`;
    const title = (event.summary ?? "(No title)").trim() || "(No title)";
    const description = event.description?.trim() || undefined;

    if (event.isRecurring()) {
      const expand = event.iterator();
      let next: ICAL.Time | null;
      let count = 0;
      while (count < MAX_OCCURRENCES_PER_VEVENT && (next = expand.next())) {
        count += 1;
        const startMs = next.toJSDate().getTime();
        if (startMs > rangeEnd) break;
        if (startMs < rangeStart) continue;
        const details = event.getOccurrenceDetails(next);
        const sd = details.startDate;
        const ed = details.endDate;
        if (!sd) continue;
        const startTime = sd.toJSDate().getTime();
        const endTime = ed ? ed.toJSDate().getTime() : startTime + 60 * 60 * 1000;
        const allDay = Boolean(sd.isDate);
        const instanceKey = `${uid}|${startTime}`;
        if (seen.has(instanceKey)) continue;
        seen.add(instanceKey);
        out.push({
          instanceKey,
          icalUid: uid,
          title,
          description,
          startTime,
          endTime: Math.max(endTime, startTime + 60 * 1000),
          allDay,
        });
      }
    } else {
      const sd = event.startDate;
      if (!sd) continue;
      const startTime = sd.toJSDate().getTime();
      if (startTime > rangeEnd || startTime < rangeStart - 86400000) continue;
      const ed = event.endDate;
      const endTime = ed ? ed.toJSDate().getTime() : startTime + 60 * 60 * 1000;
      const allDay = Boolean(sd.isDate);
      const instanceKey = `${uid}|${startTime}`;
      if (seen.has(instanceKey)) continue;
      seen.add(instanceKey);
      out.push({
        instanceKey,
        icalUid: uid,
        title,
        description,
        startTime,
        endTime: Math.max(endTime, startTime + 60 * 1000),
        allDay,
      });
    }
  }

  return out;
}

export const listSubscriptions = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    return await ctx.db
      .query("icsCalendarSubscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

export const listInRange = query({
  args: {
    workspaceId: v.id("workspaces"),
    start: v.number(),
    end: v.number(),
  },
  handler: async (ctx, { workspaceId, start, end }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const all = await ctx.db
      .query("icsCalendarEvents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    return all.filter(
      (e) =>
        (e.startTime >= start && e.startTime <= end) ||
        (e.endTime >= start && e.endTime <= end) ||
        (e.startTime <= start && e.endTime >= end),
    );
  },
});

export const listUpcoming = query({
  args: {
    workspaceId: v.id("workspaces"),
    from: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, from, limit }) => {
    await requireWorkspaceAccess(ctx, workspaceId);
    const all = await ctx.db
      .query("icsCalendarEvents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const upcoming = all
      .filter((e) => e.endTime >= from)
      .sort((a, b) => a.startTime - b.startTime);
    return upcoming.slice(0, limit ?? 50);
  },
});

export const upsertSubscription = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.optional(v.id("icsCalendarSubscriptions")),
    name: v.string(),
    icsUrl: v.string(),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireWorkspaceAccess(ctx, args.workspaceId);
    const url = normalizeIcsUrl(args.icsUrl);
    assertHttpUrl(url);
    const name = args.name.trim() || "Calendar";
    const enabled = args.enabled ?? true;
    const now = Date.now();

    if (args.subscriptionId) {
      const existing = await ctx.db.get(args.subscriptionId);
      if (!existing || existing.workspaceId !== args.workspaceId) {
        throw new Error("Subscription not found");
      }
      await ctx.db.patch(args.subscriptionId, {
        name,
        icsUrl: url,
        enabled,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.icsCalendar.syncSubscription, {
        subscriptionId: args.subscriptionId,
      });
      return args.subscriptionId;
    }

    const id = await ctx.db.insert("icsCalendarSubscriptions", {
      workspaceId: args.workspaceId,
      name,
      icsUrl: url,
      enabled,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.icsCalendar.syncSubscription, {
      subscriptionId: id,
    });
    return id;
  },
});

export const removeSubscription = mutation({
  args: { subscriptionId: v.id("icsCalendarSubscriptions") },
  handler: async (ctx, { subscriptionId }) => {
    const sub = await ctx.db.get(subscriptionId);
    if (!sub) return;
    await requireWorkspaceAccess(ctx, sub.workspaceId);
    const events = await ctx.db
      .query("icsCalendarEvents")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", subscriptionId))
      .collect();
    for (const e of events) {
      await ctx.db.delete(e._id);
    }
    await ctx.db.delete(subscriptionId);
  },
});

export const triggerSync = mutation({
  args: { subscriptionId: v.id("icsCalendarSubscriptions") },
  handler: async (ctx, { subscriptionId }) => {
    const sub = await ctx.db.get(subscriptionId);
    if (!sub) throw new Error("Not found");
    await requireWorkspaceAccess(ctx, sub.workspaceId);
    await ctx.scheduler.runAfter(0, internal.icsCalendar.syncSubscription, {
      subscriptionId,
    });
  },
});

export const listEnabledSubscriptionsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("icsCalendarSubscriptions")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
  },
});

export const replaceSubscriptionEvents = internalMutation({
  args: {
    subscriptionId: v.id("icsCalendarSubscriptions"),
    workspaceId: v.id("workspaces"),
    events: v.array(
      v.object({
        instanceKey: v.string(),
        icalUid: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        startTime: v.number(),
        endTime: v.number(),
        allDay: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { subscriptionId, workspaceId, events }) => {
    const existing = await ctx.db
      .query("icsCalendarEvents")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", subscriptionId))
      .collect();
    for (const e of existing) {
      await ctx.db.delete(e._id);
    }
    for (const e of events) {
      await ctx.db.insert("icsCalendarEvents", {
        workspaceId,
        subscriptionId,
        instanceKey: e.instanceKey,
        icalUid: e.icalUid,
        title: e.title,
        description: e.description,
        startTime: e.startTime,
        endTime: e.endTime,
        allDay: e.allDay,
      });
    }
    await ctx.db.patch(subscriptionId, {
      lastSyncedAt: Date.now(),
      lastError: undefined,
    });
  },
});

export const touchSubscriptionAttempt = internalMutation({
  args: { subscriptionId: v.id("icsCalendarSubscriptions") },
  handler: async (ctx, { subscriptionId }) => {
    await ctx.db.patch(subscriptionId, { lastAttemptAt: Date.now() });
  },
});

export const patchSubscriptionSyncError = internalMutation({
  args: {
    subscriptionId: v.id("icsCalendarSubscriptions"),
    lastError: v.string(),
  },
  handler: async (ctx, { subscriptionId, lastError }) => {
    await ctx.db.patch(subscriptionId, { lastError });
  },
});

export const syncSubscription = internalAction({
  args: { subscriptionId: v.id("icsCalendarSubscriptions") },
  handler: async (ctx, { subscriptionId }) => {
    const sub = await ctx.runQuery(internal.icsCalendar.getSubscriptionForSync, {
      subscriptionId,
    });
    if (!sub || !sub.enabled) return;

    await ctx.runMutation(internal.icsCalendar.touchSubscriptionAttempt, {
      subscriptionId,
    });

    let fetchError: string | null = null;
    let occurrences: ParsedOccurrence[] = [];

    try {
      const fetchHeaders: Record<string, string> = { ...ICS_FETCH_HEADERS };
      if (sub.icsUrl.includes("icloud.com")) {
        fetchHeaders.Referer = "https://www.icloud.com/";
      }
      const res = await fetch(sub.icsUrl, {
        method: "GET",
        redirect: "follow",
        headers: fetchHeaders,
      });
      if (!res.ok) {
        fetchError = `HTTP ${res.status}`;
      } else {
        const text = await res.text();
        if (!responseLooksLikeIcs(text)) {
          const t = text.trim();
          if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) {
            fetchError =
              "Server returned HTML instead of a calendar file. iCloud often requires a normal browser request — try again, or open the same URL in Safari to confirm it downloads .ics.";
          } else if (t.length === 0) {
            fetchError = "Empty response from calendar URL.";
          } else {
            fetchError =
              "Response was not valid ICS (missing BEGIN:VCALENDAR). Check the published link.";
          }
        } else {
          occurrences = parseIcsToOccurrences(text, Date.now());
        }
      }
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e);
    }

    if (fetchError) {
      await ctx.runMutation(internal.icsCalendar.patchSubscriptionSyncError, {
        subscriptionId,
        lastError: fetchError,
      });
      return;
    }

    await ctx.runMutation(internal.icsCalendar.replaceSubscriptionEvents, {
      subscriptionId,
      workspaceId: sub.workspaceId,
      events: occurrences.map((o) => ({
        instanceKey: o.instanceKey,
        icalUid: o.icalUid,
        title: o.title,
        description: o.description,
        startTime: o.startTime,
        endTime: o.endTime,
        allDay: o.allDay,
      })),
    });
  },
});

export const getSubscriptionForSync = internalQuery({
  args: { subscriptionId: v.id("icsCalendarSubscriptions") },
  handler: async (ctx, { subscriptionId }) => {
    return await ctx.db.get(subscriptionId);
  },
});

export const syncAllSubscriptions = internalAction({
  args: {},
  handler: async (ctx) => {
    const subs = await ctx.runQuery(
      internal.icsCalendar.listEnabledSubscriptionsInternal,
      {},
    );
    for (const sub of subs) {
      await ctx.runAction(internal.icsCalendar.syncSubscription, {
        subscriptionId: sub._id,
      });
    }
  },
});
