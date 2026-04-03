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
        v.literal("/messages"),
      ),
    ),
    timezone: v.optional(v.string()),
    timeFormat: v.optional(v.union(v.literal("12"), v.literal("24"))),
    weekStartsOn: v.optional(
      v.union(v.literal("sunday"), v.literal("monday")),
    ),
    /** Denormalized from last workspace-wide team message (Messages → Team). */
    teamChatLastAt: v.optional(v.number()),
    teamChatPreview: v.optional(v.string()),
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

  /**
   * Auth-backed workspace collaborators (invite / accept flow).
   * Workspace owner is `workspaces.ownerId` — not duplicated here.
   */
  workspaceUserMemberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_user", ["userId"]),

  workspaceInvites: defineTable({
    workspaceId: v.id("workspaces"),
    /** Normalized lowercase email of an existing Kruvan account. */
    email: v.string(),
    invitedByUserId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("cancelled"),
    ),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_email_status", ["email", "status"]),

  workspaceMessages: defineTable({
    workspaceId: v.id("workspaces"),
    senderId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  })
    .index("by_workspace_created", ["workspaceId", "createdAt"]),

  /** Direct message thread (1:1). */
  conversations: defineTable({
    kind: v.literal("dm"),
    /** Deterministic key so two users always map to one row: `id1|id2` lexicographic. */
    dmPairKey: v.string(),
    createdAt: v.number(),
    lastMessageAt: v.number(),
    lastMessageBody: v.optional(v.string()),
  }).index("by_dm_pair", ["dmPairKey"]),

  conversationParticipants: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"]),

  directMessages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_conversation_created", ["conversationId", "createdAt"]),

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
    /** Order within the same workspace + project + status (0 = first). */
    sortOrder: v.optional(v.number()),
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
    blockedByTaskId: v.optional(v.id("tasks")),
    recurrence: v.optional(
      v.object({
        freq: v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("monthly"),
        ),
        interval: v.number(),
        anchor: v.optional(v.number()),
        until: v.optional(v.number()),
      }),
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

  /** Published ICS URL (e.g. Outlook) — mirrored read-only in `icsCalendarEvents`. */
  icsCalendarSubscriptions: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    icsUrl: v.string(),
    enabled: v.boolean(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    /** Last successful ICS import. */
    lastSyncedAt: v.optional(v.number()),
    /** Every fetch attempt (success or failure). */
    lastAttemptAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_enabled", ["enabled"]),

  icsCalendarEvents: defineTable({
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("icsCalendarSubscriptions"),
    instanceKey: v.string(),
    icalUid: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    allDay: v.boolean(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_subscription", ["subscriptionId"]),

  projectActivities: defineTable({
    workspaceId: v.id("workspaces"),
    projectId: v.id("projects"),
    actorUserId: v.id("users"),
    kind: v.union(
      v.literal("task_created"),
      v.literal("task_completed"),
      v.literal("task_updated"),
      v.literal("project_updated"),
      v.literal("project_duplicated"),
    ),
    summary: v.string(),
    taskId: v.optional(v.id("tasks")),
    createdAt: v.number(),
  }).index("by_project", ["projectId", "createdAt"]),

  userInboxNotifications: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    kind: v.literal("team_mention"),
    title: v.string(),
    body: v.string(),
    messageId: v.id("workspaceMessages"),
    fromUserId: v.id("users"),
    createdAt: v.number(),
    dismissedAt: v.optional(v.number()),
  })
    .index("by_user_workspace", ["userId", "workspaceId"])
    .index("by_user_created", ["userId", "createdAt"]),

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
