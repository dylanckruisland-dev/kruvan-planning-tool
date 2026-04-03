import type { ParsedLocation } from "@tanstack/react-router";

export type OpenTabType =
  | "overview"
  | "projects"
  | "project"
  | "tasks"
  | "task"
  | "notes"
  | "note"
  | "agenda"
  | "event"
  | "content"
  | "contentItem"
  | "messages"
  | "settings";

export type OpenTab = {
  key: string;
  type: OpenTabType;
  title: string;
  href: string;
};

function searchRecord(loc: ParsedLocation): Record<string, unknown> {
  if (typeof loc.search === "object" && loc.search !== null) {
    return loc.search as Record<string, unknown>;
  }
  return {};
}

/** Stable key for deduplicating tabs (routing remains source of truth for URL details). */
export function tabKeyFromLocation(loc: ParsedLocation): string {
  const pathname = loc.pathname;
  const search = searchRecord(loc);

  if (pathname === "/") return "tab:/";
  if (pathname === "/settings") return "tab:/settings";

  if (pathname.startsWith("/projects/") && pathname.length > "/projects/".length) {
    const projectId = pathname.slice("/projects/".length).split("/")[0];
    return `tab:project:${projectId}`;
  }

  if (pathname === "/projects") return "tab:/projects";

  if (pathname === "/tasks") {
    const task =
      typeof search.task === "string" && search.task.length > 0
        ? search.task
        : undefined;
    if (task) return `tab:task:${task}`;
    return "tab:/tasks";
  }

  if (pathname === "/notes") {
    const note =
      typeof search.note === "string" && search.note.length > 0
        ? search.note
        : undefined;
    if (note) return `tab:note:${note}`;
    return "tab:/notes";
  }

  if (pathname === "/agenda") {
    const event =
      typeof search.event === "string" && search.event.length > 0
        ? search.event
        : undefined;
    if (event) return `tab:event:${event}`;
    return "tab:/agenda";
  }

  if (pathname === "/content") {
    const content =
      typeof search.content === "string" && search.content.length > 0
        ? search.content
        : undefined;
    if (content) return `tab:content:${content}`;
    return "tab:/content";
  }

  if (pathname === "/messages") {
    const team =
      typeof search.team === "string" && search.team.length > 0
        ? search.team
        : undefined;
    if (team) return `tab:msg-team:${team}`;
    const conv =
      typeof search.conversation === "string" && search.conversation.length > 0
        ? search.conversation
        : undefined;
    if (conv) return `tab:msg-dm:${conv}`;
    return "tab:/messages";
  }

  return `tab:${pathname}`;
}

export function defaultTitleForLocation(loc: ParsedLocation): string {
  const pathname = loc.pathname;
  const search = searchRecord(loc);

  if (pathname === "/") return "Overview";
  if (pathname === "/settings") return "Settings";
  if (pathname === "/projects") return "Projects";
  if (pathname.startsWith("/projects/")) return "Project";
  if (pathname === "/tasks") {
    if (
      typeof search.task === "string" &&
      search.task.length > 0
    ) {
      return "Task";
    }
    return "Tasks";
  }
  if (pathname === "/notes") {
    if (
      typeof search.note === "string" &&
      search.note.length > 0
    ) {
      return "Note";
    }
    return "Notes";
  }
  if (pathname === "/agenda") {
    if (
      typeof search.event === "string" &&
      search.event.length > 0
    ) {
      return "Event";
    }
    return "Agenda";
  }
  if (pathname === "/content") {
    if (
      typeof search.content === "string" &&
      search.content.length > 0
    ) {
      return "Content";
    }
    return "Content";
  }
  if (pathname === "/messages") {
    if (search.team) return "Team";
    if (search.conversation) return "Messages";
    return "Messages";
  }
  return "Page";
}

export function inferTabType(key: string, pathname: string): OpenTabType {
  if (pathname === "/") return "overview";
  if (pathname === "/settings") return "settings";
  if (pathname.startsWith("/projects/")) return "project";
  if (pathname === "/projects") return "projects";
  if (pathname === "/tasks") return key.startsWith("tab:task:") ? "task" : "tasks";
  if (pathname === "/notes") return key.startsWith("tab:note:") ? "note" : "notes";
  if (pathname === "/agenda") return key.startsWith("tab:event:") ? "event" : "agenda";
  if (pathname === "/content") {
    return key.startsWith("tab:content:") ? "contentItem" : "content";
  }
  if (pathname === "/messages") return "messages";
  return "overview";
}
