import { ArrowRight, Calendar, CheckCircle2, FolderKanban } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useShellActions } from "@/contexts/ShellActionsContext";
import { useWorkspaceDisplay } from "@/hooks/useWorkspaceDisplay";
import { useWorkspace } from "@/hooks/useWorkspace";
import { addDays, startOfDay } from "@/lib/dates";

export function OverviewPage() {
  const { openQuickAdd } = useShellActions();
  const { workspaceId, workspace } = useWorkspace();
  const { formatTime, formatShortDate } = useWorkspaceDisplay();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!workspace || pathname !== "/") return;
    const target = workspace.defaultLandingRoute;
    if (!target || target === "/") return;
    if (sessionStorage.getItem("kruvan-landing") === "1") return;
    sessionStorage.setItem("kruvan-landing", "1");
    navigate({ to: target });
  }, [workspace, pathname, navigate]);
  const data = useQuery(
    api.dashboard.getOverview,
    workspaceId ? { workspaceId } : "skip",
  );

  const weekRangeStart = startOfDay(new Date());
  const weekRangeEnd = addDays(weekRangeStart, 7);
  const upcomingContentPlans = useQuery(
    api.contentPlans.listScheduledInRange,
    workspaceId
      ? {
          workspaceId,
          start: weekRangeStart.getTime(),
          end: weekRangeEnd.getTime(),
        }
      : "skip",
  );

  if (!workspaceId || data === undefined) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const openTasks = data.tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled",
  ).length;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Overview"
        description="A clear view of everything that matters"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Active projects
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
            {data.projects.filter((p) => p.status === "active").length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {data.projects.length} total in workspace
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Open tasks
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
            {openTasks}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {data.tasks.filter((t) => t.status === "done").length} completed
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Notes
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
            {data.notes.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Captured this cycle</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Upcoming events
            </h2>
            <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
          </div>
          <ul className="space-y-3">
            {data.upcomingEvents.map((e) => (
              <li key={e._id}>
                <Link
                  to="/agenda"
                  search={{ event: String(e._id) }}
                  className="block rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <p className="font-semibold text-slate-900">{e.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {e.allDay
                      ? formatShortDate(e.startTime)
                      : `${formatShortDate(e.startTime)} · ${formatTime(e.startTime)} – ${formatTime(e.endTime)}`}
                  </p>
                </Link>
              </li>
            ))}
            {data.upcomingEvents.length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">
                No upcoming events.
              </li>
            ) : null}
          </ul>
          <Link
            to="/agenda"
            search={{ event: undefined }}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-strong"
          >
            Full agenda
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Upcoming tasks
            </h2>
            <CheckCircle2 className="h-4 w-4 text-slate-400" aria-hidden />
          </div>
          <ul className="space-y-3">
            {data.upcomingTasks.map((t) => (
              <li key={t._id}>
                <Link
                  to="/tasks"
                  search={{ task: String(t._id), taskView: undefined }}
                  className="block rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <p className="font-semibold text-slate-900">{t.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.dueDate
                      ? `Due ${formatShortDate(t.dueDate)}`
                      : "No due date"}
                  </p>
                </Link>
              </li>
            ))}
            {data.upcomingTasks.length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">
                No upcoming tasks.
              </li>
            ) : null}
          </ul>
          <Link
            to="/tasks"
            search={{ task: undefined, taskView: undefined }}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-strong"
          >
            All tasks
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Upcoming content
          </h2>
          <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Your scheduled content for the next week
        </p>
        <ul className="mt-4 space-y-3">
          {upcomingContentPlans === undefined ? (
            <li className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <>
              {[...upcomingContentPlans]
                .sort(
                  (a, b) =>
                    (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0),
                )
                .slice(0, 10)
                .map((plan) => {
                  const ts = plan.scheduledFor;
                  const when =
                    ts == null
                      ? "—"
                      : startOfDay(new Date(ts)).getTime() ===
                          weekRangeStart.getTime()
                        ? `Today · ${formatTime(ts)}`
                        : `${formatShortDate(ts)} · ${formatTime(ts)}`;
                  return (
                    <li key={plan._id}>
                      <Link
                        to="/content"
                        search={{
                          content: String(plan._id),
                          view: "calendar",
                        }}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 transition hover:border-slate-200 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {plan.title}
                          </p>
                          <p className="text-xs text-slate-500">{when}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              {upcomingContentPlans.length === 0 ? (
                <li className="text-sm text-slate-500">
                  Nothing scheduled
                </li>
              ) : null}
            </>
          )}
        </ul>
        <Link
          to="/content"
          search={{ content: undefined, view: "calendar" }}
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-strong"
        >
          Content calendar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent projects
          </h2>
          <Link
            to="/projects"
            search={{ project: undefined, folder: undefined }}
            className="text-xs font-semibold text-accent hover:text-accent-strong"
          >
            View all
          </Link>
        </div>
        {data.recentProjects.length === 0 ? (
          <EmptyState
            className="py-10"
            icon={FolderKanban}
            title="No projects yet"
            description="Create a project to group tasks, deadlines, and notes."
            action={
              <Link
                to="/projects"
                search={{ project: undefined, folder: undefined }}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Go to projects
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.recentProjects.map((p) => (
              <ProjectCard
                key={p._id}
                project={p}
                taskCount={data.tasks.filter((t) => t.projectId === p._id).length}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={openQuickAdd}
        className="w-full rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-left transition hover:border-slate-300 hover:bg-white"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Quick-add something new
              </p>
              <p className="text-xs text-slate-500">
                Press ⌘N anywhere in the app, or use Create in the header.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="pointer-events-none rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
              Task
            </span>
            <span className="pointer-events-none rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
              Note
            </span>
            <span className="pointer-events-none rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
              Event
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
