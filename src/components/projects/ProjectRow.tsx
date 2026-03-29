import { Folder, FolderKanban, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { Doc } from "@cvx/_generated/dataModel";

type Project = Doc<"projects">;

type Props = {
  project: Project;
  taskCount: number;
  tagNames: string[];
  /** Folder path, e.g. `Parent / Child` when the project lives in a nested folder. */
  folderPath?: string;
  onDelete?: () => void;
  className?: string;
};

export function ProjectRow({
  project,
  taskCount,
  tagNames,
  folderPath,
  onDelete,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "group flex items-stretch overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md",
        className,
      )}
    >
    <Link
      to="/projects/$projectId"
      params={{ projectId: String(project._id) }}
      search={{ tab: "overview", taskView: "list" }}
      className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <FolderKanban className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="flex min-w-0 items-center justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
              {project.name}
            </span>
            {folderPath ? (
              <span className="flex min-w-0 max-w-[min(100%,12rem)] shrink-0 items-center gap-1 text-xs text-slate-500">
                <Folder
                  className="h-3.5 w-3.5 shrink-0 text-slate-400"
                  aria-hidden
                />
                <span className="truncate">{folderPath}</span>
              </span>
            ) : null}
          </p>
          {project.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
              {project.description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        <StatusBadge status={project.status} />
      </div>
      <div className="hidden md:flex">
        <PriorityBadge priority={project.priority} />
      </div>
      <div className="hidden text-sm text-slate-600 md:block">
        {formatShortDate(project.dueDate)}
      </div>
      <div className="hidden flex-wrap gap-1 md:flex">
        {tagNames.slice(0, 3).map((t) => (
          <span
            key={t}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3 text-right">
        <div className="hidden w-24 md:block">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-accent-solid transition-all"
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {project.progress}% · {taskCount} tasks
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500 md:hidden">
          {taskCount} tasks
        </span>
      </div>
    </Link>
    {onDelete ? (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="shrink-0 border-l border-slate-100 px-3 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        aria-label={`Delete project ${project.name}`}
      >
        <Trash2 className="mx-auto h-4 w-4" />
      </button>
    ) : null}
    </div>
  );
}
