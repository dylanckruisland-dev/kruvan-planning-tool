import { Bell, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  projectsListSearch,
  tasksPageSearch,
} from "@/lib/router-search-defaults";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/cn";
import { dueUrgencyTextClass } from "@/lib/due-urgency";

export function NotificationMenu() {
  const { workspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const items = useQuery(
    api.notifications.list,
    workspaceId ? { workspaceId } : "skip",
  );

  const dismiss = useMutation(api.notifications.dismiss);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }
  }, [open]);

  const count = items?.length ?? 0;
  const hasUnread = count > 0;

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800",
          open && "bg-slate-100 text-slate-800",
        )}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        disabled={!workspaceId}
      >
        <Bell className="h-4 w-4" />
        {hasUnread ? (
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-solid ring-2 ring-white"
            aria-hidden
          />
        ) : null}
      </button>

      {open && workspaceId ? (
        <div
          className="absolute right-0 z-[100] mt-2 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg ring-1 ring-black/5"
          role="menu"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-semibold text-slate-900">Notifications</p>
            <p className="text-[11px] text-slate-500">
              Deadlines and due dates for this workspace
            </p>
          </div>
          {items === undefined ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              You&apos;re all caught up. No active alerts.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {items.map((item) => (
                <li
                  key={item.fingerprint}
                  className="group flex border-b border-slate-50 last:border-b-0"
                >
                  {item.link.to === "/tasks" ? (
                    <Link
                      to="/tasks"
                      search={{
                        ...tasksPageSearch,
                        task: item.link.search.task,
                        taskView: undefined,
                      }}
                      onClick={() => setOpen(false)}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left transition hover:bg-slate-50"
                      role="menuitem"
                    >
                      <p
                        className={cn(
                          "text-sm font-medium",
                          dueUrgencyTextClass(item.dueUrgency),
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {item.body}
                      </p>
                    </Link>
                  ) : item.link.to === "/messages" ? (
                    <Link
                      to="/messages"
                      search={{
                        team: item.link.search.team,
                        conversation: undefined,
                      }}
                      onClick={() => setOpen(false)}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left transition hover:bg-slate-50"
                      role="menuitem"
                    >
                      <p
                        className={cn(
                          "text-sm font-medium",
                          dueUrgencyTextClass(item.dueUrgency),
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {item.body}
                      </p>
                    </Link>
                  ) : (
                    <Link
                      to="/projects"
                      search={{
                        ...projectsListSearch,
                        project: item.link.search.project,
                        folder: undefined,
                      }}
                      onClick={() => setOpen(false)}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left transition hover:bg-slate-50"
                      role="menuitem"
                    >
                      <p
                        className={cn(
                          "text-sm font-medium",
                          dueUrgencyTextClass(item.dueUrgency),
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {item.body}
                      </p>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void dismiss({
                        workspaceId,
                        fingerprint: item.fingerprint,
                      });
                    }}
                    className="flex shrink-0 items-center px-2 text-slate-400 opacity-70 transition hover:text-slate-700 group-hover:opacity-100"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
