/** Emoji + label for @mention dropdown section headers (grouped by type). */
export const MENTION_SECTION_UI: Record<
  string,
  { emoji: string; title: string }
> = {
  task: { emoji: "📋", title: "Task" },
  note: { emoji: "📝", title: "Note" },
  project: { emoji: "📁", title: "Project" },
  event: { emoji: "📅", title: "Event" },
  assignee: { emoji: "👤", title: "Assignee" },
  content: { emoji: "📄", title: "Content" },
};

export function mentionSectionHeader(kind: string): { emoji: string; title: string } {
  return MENTION_SECTION_UI[kind] ?? { emoji: "•", title: kind };
}
