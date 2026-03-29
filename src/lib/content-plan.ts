import type { Doc } from "@cvx/_generated/dataModel";

export type ContentPlatform = Doc<"contentPlans">["platforms"][number];
export type ContentStatus = Doc<"contentPlans">["status"];

export const CONTENT_STATUS_ORDER: ContentStatus[] = [
  "idea",
  "draft",
  "scheduled",
  "published",
  "skipped",
];

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Ideas",
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  skipped: "Skipped",
};

export const CONTENT_PLATFORM_LABEL: Record<ContentPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
  threads: "Threads",
  other: "Other",
};

export const ALL_PLATFORMS: ContentPlatform[] = [
  "instagram",
  "tiktok",
  "youtube",
  "x",
  "linkedin",
  "threads",
  "other",
];

/** Chips shown in the editor (excludes internal default `"other"`). */
export const PLATFORM_PRESETS: ContentPlatform[] = [
  "instagram",
  "tiktok",
  "youtube",
  "x",
  "linkedin",
  "threads",
];

export function isImageContentType(contentType?: string) {
  return Boolean(contentType?.startsWith("image/"));
}

export function isVideoContentType(contentType?: string) {
  return Boolean(contentType?.startsWith("video/"));
}
