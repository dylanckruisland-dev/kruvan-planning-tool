import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatShortDate } from "@/lib/dates";
import { projectDetailDefaultSearch } from "@/lib/router-search-defaults";
import { cn } from "@/lib/cn";
import type { Doc } from "@cvx/_generated/dataModel";

type Project = Doc<"projects">;

type Props = {
  project: Project;
  taskCount: number;
  className?: string;
};

export function ProjectCard({ project, taskCount, className }: Props) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: String(project._id) }}
      search={{ ...projectDetailDefaultSearch }}
      aria-label={`Open project ${project.name}`}
      className={cn(
        "group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{project.name}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
            {project.description ?? "No description"}
          </p>
        </div>
        <span
          className="rounded-lg p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 group-hover:bg-slate-100 group-hover:text-slate-700"
          aria-hidden
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={project.status} />
        <PriorityBadge priority={project.priority} />
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Progress</span>
          <span>{project.progress}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-accent-solid"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>Due {formatShortDate(project.dueDate)}</span>
        <span>{taskCount} tasks</span>
      </div>
    </Link>
  );
}
