import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const priority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);

const projectStatus = v.union(
  v.literal("planning"),
  v.literal("active"),
  v.literal("on_hold"),
  v.literal("done"),
);

const taskStatus = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("cancelled"),
);

export default defineSchema({
  ...authTables,

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerId: v.optional(v.id("users")),
    accent: v.optional(v.string()),
    defaultAgendaView: v.optional(
      v.union(v.literal("week"), v.literal("day")),
    ),
    defaultTaskView: v.optional(
      v.union(v.literal("list"), v.literal("board")),
    ),
    defaultLandingRoute: v.optional(
      v.union(
        v.literal("/"),
        v.literal("/agenda"),
        v.literal("/tasks"),
        v.literal("/notes"),
        v.literal("/content"),
        v.literal("/projects"),
        v.literal("/settings"),
      ),
    ),
    timezone: v.optional(v.string()),
    timeFormat: v.optional(v.union(v.literal("12"), v.literal("24"))),
    weekStartsOn: v.optional(
      v.union(v.literal("sunday"), v.literal("monday")),
    ),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  /** Organizational only — groups projects & notes; never tasks directly. */
  folders: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    sortOrder: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_parent", ["parentId"]),

  tags: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  /** People you can assign tasks to within a workspace (display names; not auth users). */
  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    email: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  projects: defineTable({
    workspaceId: v.id("workspaces"),
    folderId: v.optional(v.id("folders")),
    name: v.string(),
    description: v.optional(v.string()),
    status: projectStatus,
    priority,
    dueDate: v.optional(v.number()),
    progress: v.number(),
    tagIds: v.array(v.id("tags")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_folder", ["folderId"]),

  tasks: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    /** Calendar time block (agenda). */
    scheduledStart: v.optional(v.number()),
    scheduledEnd: v.optional(v.number()),
    status: taskStatus,
    priority,
    /** Legacy pre–workspace-members; migrate with `migrations:migrateTaskAssigneesToWorkspaceMembers` */
    assigneeId: v.optional(v.id("users")),
    assigneeMemberId: v.optional(v.id("workspaceMembers")),
    labelIds: v.array(v.id("tags")),
    completedAt: v.optional(v.number()),
    subtasks: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          done: v.boolean(),
        }),
      ),
    ),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_project", ["projectId"]),

  events: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    taskId: v.optional(v.id("tasks")),
    projectId: v.optional(v.id("projects")),
    allDay: v.optional(v.boolean()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_start", ["startTime"]),

  notes: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    folderId: v.optional(v.id("folders")),
    title: v.string(),
    body: v.string(),
    /** Set once at insert; older rows may omit and fall back to `updatedAt`. */
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  contentPlans: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    notes: v.optional(v.string()),
    /** Post format: e.g. video, image, carousel, short video (user-defined). */
    contentFormat: v.optional(v.string()),
    platforms: v.array(
      v.union(
        v.literal("instagram"),
        v.literal("tiktok"),
        v.literal("youtube"),
        v.literal("x"),
        v.literal("linkedin"),
        v.literal("threads"),
        v.literal("other"),
      ),
    ),
    /** Extra channels not in the preset list (e.g. Email, Website, Snapchat). */
    customPlatforms: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("idea"),
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("published"),
      v.literal("skipped"),
    ),
    scheduledFor: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    /** User-uploaded media (Convex file storage). */
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          contentType: v.optional(v.string()),
        }),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_project", ["projectId"]),

  notificationDismissals: defineTable({
    workspaceId: v.id("workspaces"),
    fingerprint: v.string(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_fingerprint", ["workspaceId", "fingerprint"]),
});
