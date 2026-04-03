import {
  Calendar,
  CheckSquare,
  FolderKanban,
  Folders,
  Plus,
  Search,
  StickyNote,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { APP_NAV_LINKS } from "@/config/nav";
import { Skeleton } from "@/components/ui/Skeleton";
import { useWorkspaceDisplay } from "@/hooks/useWorkspaceDisplay";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/cn";
import { searchParamsForPath } from "@/lib/route-search";
import {
  projectDetailDefaultSearch,
  projectsListSearch,
  tasksPageSearch,
} from "@/lib/router-search-defaults";
import { htmlToPlainText } from "@/lib/note-html";
import { readRecentRoutes, recentRouteLabel } from "@/lib/recent-routes";

const EVENTS_RANGE_END = 4102444800000;

function matchesQuery(q: string, ...parts: (string | undefined)[]) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return parts.some((p) => p?.toLowerCase().includes(s));
}

function RecentPaletteLink({
  path,
  onClose,
}: {
  path: string;
  onClose: () => void;
}) {
  const label = recentRouteLabel(path);
  const staticNav = APP_NAV_LINKS.find((l) => l.to === path);
  if (staticNav) {
    const navSearch = searchParamsForPath(staticNav.to);
    const Icon = staticNav.icon;
    return (
      <Link
        to={staticNav.to}
        {...(navSearch !== undefined ? { search: navSearch } : {})}
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-50"
      >
        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </Link>
    );
  }
  const m = path.match(/^\/projects\/([^/]+)$/);
  if (m?.[1]) {
    return (
      <Link
        to="/projects/$projectId"
        params={{ projectId: m[1] }}
        search={{ ...projectDetailDefaultSearch }}
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-50"
      >
        <FolderKanban className="h-4 w-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </Link>
    );
  }
  return null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Sneltoets-actie: Quick add (⌘N) */
  onQuickAdd?: () => void;
};

export function CommandPalette({ open, onClose, onQuickAdd }: Props) {
  const [q, setQ] = useState("");
  const [recentSnapshot, setRecentSnapshot] = useState<string[]>([]);
  const { workspaceId } = useWorkspace();
  const { formatTime, formatShortDate } = useWorkspaceDisplay();

  const projects = useQuery(
    api.projects.listByWorkspace,
    workspaceId && open ? { workspaceId } : "skip",
  );
  const tasks = useQuery(
    api.tasks.listByWorkspace,
    workspaceId && open ? { workspaceId } : "skip",
  );
  const notes = useQuery(
    api.notes.listByWorkspace,
    workspaceId && open ? { workspaceId } : "skip",
  );
  const events = useQuery(
    api.events.listInRange,
    workspaceId && open
      ? { workspaceId, start: 0, end: EVENTS_RANGE_END }
      : "skip",
  );
  const folders = useQuery(
    api.folders.listByWorkspace,
    workspaceId && open ? { workspaceId } : "skip",
  );

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset query when palette closes
      setQ("");
    } else {
      setRecentSnapshot(readRecentRoutes());
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  const filteredNav = useMemo(() => {
    return APP_NAV_LINKS.filter((l) => matchesQuery(q, l.label));
  }, [q]);

  const filteredRecent = useMemo(() => {
    return recentSnapshot.filter((path) => {
      const known =
        APP_NAV_LINKS.some((l) => l.to === path) ||
        /^\/projects\/[^/]+$/.test(path);
      if (!known) return false;
      return matchesQuery(q, recentRouteLabel(path), path);
    });
  }, [recentSnapshot, q]);

  const filteredQuickActions = useMemo(() => {
    const s = q.trim().toLowerCase();
    const hits: {
      id: string;
      node: ReactNode;
    }[] = [];

    const pushLink = (
      id: string,
      label: string,
      keywords: string[],
      to: (typeof APP_NAV_LINKS)[number]["to"],
      icon: (typeof APP_NAV_LINKS)[number]["icon"],
    ) => {
      if (!matchesQuery(q, label, ...keywords)) return;
      const navSearch = searchParamsForPath(to);
      const Icon = icon;
      hits.push({
        id,
        node: (
          <li key={id}>
            <Link
              to={to}
              {...(navSearch !== undefined ? { search: navSearch } : {})}
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-50"
            >
              <Icon className="h-4 w-4 shrink-0 text-accent" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span>{label}</span>
                <span className="text-[11px] font-normal text-slate-400">
                  Open view
                </span>
              </span>
            </Link>
          </li>
        ),
      });
    };

    if (
      onQuickAdd &&
      matchesQuery(q, "quick add", "new", "create", "add", "⌘")
    ) {
      hits.push({
        id: "action-quickadd",
        node: (
          <li key="action-quickadd">
            <button
              type="button"
              onClick={() => {
                onQuickAdd();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span>Quick add</span>
                <span className="text-[11px] font-normal text-slate-400">
                  Task, note, event… · ⌘N
                </span>
              </span>
            </button>
          </li>
        ),
      });
    }

    /* Avoid duplicate “Go to …” when query is empty — Views section covers that. Only when searching. */
    if (s) {
      pushLink("go-agenda", "Go to Agenda", ["calendar", "planning", "agenda"], "/agenda", Calendar);
      pushLink("go-tasks", "Go to Tasks", ["tasks", "todo", "todos"], "/tasks", CheckSquare);
      pushLink("go-projects", "Go to Projects", ["folders", "projects"], "/projects", FolderKanban);
    }

    return hits;
  }, [q, onQuickAdd, onClose]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) =>
      matchesQuery(q, p.name, p.description ?? ""),
    );
  }, [projects, q]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) =>
      matchesQuery(q, t.title, t.description ?? ""),
    );
  }, [tasks, q]);

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    return notes.filter((n) =>
      matchesQuery(q, n.title, n.body),
    );
  }, [notes, q]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((ev) =>
      matchesQuery(q, ev.title, ev.description ?? ""),
    );
  }, [events, q]);

  const filteredFolders = useMemo(() => {
    if (!folders) return [];
    return folders.filter((f) => matchesQuery(q, f.name));
  }, [folders, q]);

  const loading =
    workspaceId &&
    open &&
    (projects === undefined ||
      tasks === undefined ||
      notes === undefined ||
      events === undefined ||
      folders === undefined);

  const hasAnyResult =
    filteredQuickActions.length > 0 ||
    filteredRecent.length > 0 ||
    filteredNav.length > 0 ||
    filteredProjects.length > 0 ||
    filteredTasks.length > 0 ||
    filteredNotes.length > 0 ||
    filteredEvents.length > 0 ||
    filteredFolders.length > 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/30 p-4 pt-[18vh] backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(70vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Search workspace"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search or jump…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {!workspaceId ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Select a workspace to search projects and notes.
            </p>
          ) : loading ? (
            <div className="space-y-3 px-4 py-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full opacity-80" />
            </div>
          ) : !hasAnyResult ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No matches
            </p>
          ) : (
            <div className="space-y-4 px-1">
              {filteredQuickActions.length > 0 ? (
                <section>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Quick actions
                  </p>
                  <ul>{filteredQuickActions.map((a) => a.node)}</ul>
                </section>
              ) : null}

              {filteredRecent.length > 0 ? (
                <section>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Recent
                  </p>
                  <ul>
                    {filteredRecent.map((path) => (
                      <li key={path}>
                        <RecentPaletteLink path={path} onClose={onClose} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {filteredNav.length > 0 ? (
                <section>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Views
                  </p>
                  <ul>
                    {filteredNav.map((l) => {
                      const navSearch = searchParamsForPath(l.to);
                      return (
                        <li key={l.to}>
                          <Link
                            to={l.to}
                            {...(navSearch !== undefined
                              ? { search: navSearch }
                              : {})}
                            onClick={onClose}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-50"
                          >
                            <l.icon className="h-4 w-4 shrink-0 text-slate-400" />
                            {l.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {filteredProjects.length > 0 ? (
                <section>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Projects
                  </p>
                  <ul>
                    {filteredProjects.map((p) => (
                      <li key={String(p._id)}>
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: String(p._id) }}
                          search={{ ...projectDetailDefaultSearch }}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm transition hover:bg-slate-50",
                          )}
                        >
                          <FolderKanban className="h-4 w-4 shrink-0 text-accent" />
                          <span className="truncate text-slate-900">{p.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {filteredTasks.length > 0 ? (
                <section>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Tasks
                  </p>
                  <ul>
                    {filteredTasks.map((t) => (
                      <li key={String(t._id)}>
                        <Link
                          to="/tasks"
                          search={{
                            ...tasksPageSearch,
                            task: String(t._id),
                            taskView: undefined,
                          }}
                          onClick={onClose}
                          className="flex items-center gap-2 px-3 py-2 text-sm transition hover:bg-slate-50"
                        >
                          <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span className="min-w-0 flex-1 truncate text-slate-900">
                            {t.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {filteredNotes.length > 0 ? (
                <section>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Notes
                  </p>
                  <ul>
                    {filteredNotes.map((n) => (
                      <li key={String(n._id)}>
                        <Link
                          to="/notes"
                          search={{ note: String(n._id) }}
                          onClick={onClose}
                          className="flex items-start gap-2 px-3 py-2 text-sm transition hover:bg-slate-50"
                        >
                          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-slate-900">
                              {n.title}
                            </span>
                            {n.body ? (
                              <span className="line-clamp-1 text-xs text-slate-500">
                                {htmlToPlainText(n.body)}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {filteredEvents.length > 0 ? (
                <section>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Events
                  </p>
                  <ul>
                    {filteredEvents.map((ev) => (
                      <li key={String(ev._id)}>
                        <Link
                          to="/agenda"
                          search={{ event: String(ev._id) }}
                          onClick={onClose}
                          className="flex items-start gap-2 px-3 py-2 text-sm transition hover:bg-slate-50"
                        >
                          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-slate-900">
                              {ev.title}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatShortDate(ev.startTime)} ·{" "}
                              {formatTime(ev.startTime)} – {formatTime(ev.endTime)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {filteredFolders.length > 0 ? (
                <section>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Folders
                  </p>
                  <ul>
                    {filteredFolders.map((f) => (
                      <li key={String(f._id)}>
                        <Link
                          to="/projects"
                          search={{
                            ...projectsListSearch,
                            project: undefined,
                            folder: String(f._id),
                          }}
                          onClick={onClose}
                          className="flex items-center gap-2 px-3 py-2 text-sm transition hover:bg-slate-50"
                        >
                          <Folders className="h-4 w-4 shrink-0 text-accent" />
                          <span className="truncate text-slate-900">{f.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
