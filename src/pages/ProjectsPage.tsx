import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { ProjectRow } from "@/components/projects/ProjectRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useToast } from "@/contexts/ToastContext";
import { useTabTitle } from "@/hooks/useTabTitle";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { ChevronDown, ChevronUp, FolderKanban, X } from "lucide-react";

type SortColumn = "status" | "priority" | "due";

const STATUS_ORDER: Record<Doc<"projects">["status"], number> = {
  planning: 0,
  active: 1,
  on_hold: 2,
  done: 3,
};

const PRIORITY_ORDER: Record<Doc<"projects">["priority"], number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

function compareProjects(
  a: Doc<"projects">,
  b: Doc<"projects">,
  column: SortColumn,
  asc: boolean,
): number {
  let cmp = 0;
  if (column === "status") {
    cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  } else if (column === "priority") {
    cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  } else {
    const aTime = a.dueDate;
    const bTime = b.dueDate;
    if (aTime == null && bTime == null) cmp = 0;
    else if (aTime == null) cmp = 1;
    else if (bTime == null) cmp = -1;
    else cmp = aTime - bTime;
  }
  return asc ? cmp : -cmp;
}

function sortProjects(
  rows: Doc<"projects">[],
  column: SortColumn,
  asc: boolean,
): Doc<"projects">[] {
  return [...rows].sort((a, b) => compareProjects(a, b, column, asc));
}

function SortColumnButton({
  label,
  column,
  activeColumn,
  direction,
  onSort,
  className,
}: {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn;
  direction: "asc" | "desc";
  onSort: (col: SortColumn) => void;
  className?: string;
}) {
  const active = activeColumn === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-0.5 py-0.5 text-left transition",
        active
          ? "text-slate-900"
          : "text-slate-400 hover:text-slate-600",
        className,
      )}
      aria-pressed={active}
      aria-label={`Sort by ${label}, ${active ? (direction === "asc" ? "ascending" : "descending") : "not active"}`}
    >
      <span>{label}</span>
      {active ? (
        direction === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
        )
      ) : (
        <span className="inline-flex flex-col opacity-40" aria-hidden>
          <ChevronUp className="h-2.5 w-2.5 -mb-1" />
          <ChevronDown className="h-2.5 w-2.5" />
        </span>
      )}
    </button>
  );
}

export function ProjectsPage() {
  useTabTitle("Projects");
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate({ from: "/projects" });
  const {
    project: projectFromUrl,
    folder: folderFromUrl,
    sort: sortFromUrl,
    dir: dirFromUrl,
  } = useSearch({
    from: "/projects",
  });
  const [search, setSearch] = useState("");

  const sortColumn: SortColumn =
    sortFromUrl === "status" ||
    sortFromUrl === "priority" ||
    sortFromUrl === "due"
      ? sortFromUrl
      : "status";
  const sortDir: "asc" | "desc" = dirFromUrl === "desc" ? "desc" : "asc";
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalKey, setCreateModalKey] = useState(0);
  const [deleteProject, setDeleteProject] = useState<{
    id: Id<"projects">;
    name: string;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const removeProjectMutation = useMutation(api.projects.remove);

  const queryArgs = useMemo(() => {
    if (!workspaceId) return "skip" as const;
    return {
      workspaceId,
      folderId: folderFromUrl
        ? (folderFromUrl as Id<"folders">)
        : undefined,
      search: search.trim() || undefined,
    };
  }, [workspaceId, folderFromUrl, search]);

  const projects = useQuery(api.projects.listByWorkspace, queryArgs);
  const tasks = useQuery(
    api.tasks.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const tags = useQuery(
    api.tags.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const folders = useQuery(
    api.folders.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );

  const sortedProjects = useMemo(() => {
    if (!projects?.length) return projects ?? [];
    return sortProjects(projects, sortColumn, sortDir === "asc");
  }, [projects, sortColumn, sortDir]);

  const filtersActive = useMemo(() => {
    return search.trim().length > 0;
  }, [search]);

  useEffect(() => {
    if (!projectFromUrl || !projects) return;
    const p = projects.find((x) => String(x._id) === projectFromUrl);
    if (p) {
      setSearch(p.name);
    }
  }, [projectFromUrl, projects]);

  const tagMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tags ?? []) {
      m.set(String(t._id), t.name);
    }
    return m;
  }, [tags]);

  const folderPathById = useMemo(() => {
    const list = folders ?? [];
    const byId = new Map(list.map((f) => [String(f._id), f]));
    function pathFor(id: Id<"folders">): string {
      const parts: string[] = [];
      let cur: Id<"folders"> | undefined = id;
      const seen = new Set<string>();
      while (cur && !seen.has(String(cur))) {
        seen.add(String(cur));
        const f = byId.get(String(cur));
        if (!f) break;
        parts.unshift(f.name);
        cur = f.parentId ?? undefined;
      }
      return parts.join(" / ");
    }
    const m = new Map<string, string>();
    for (const f of list) {
      m.set(String(f._id), pathFor(f._id));
    }
    return m;
  }, [folders]);

  const taskCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks ?? []) {
      if (!t.projectId) continue;
      const k = String(t.projectId);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [tasks]);

  function handleSortClick(col: SortColumn) {
    const nextDir =
      sortColumn === col ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    void navigate({
      search: (prev) => ({
        ...prev,
        sort: col,
        dir: nextDir,
      }),
    });
  }

  function clearFilters() {
    setSearch("");
  }

  function openCreateModal() {
    setCreateModalKey((k) => k + 1);
    setCreateModalOpen(true);
  }

  if (!workspaceId || projects === undefined) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />;
  }

  async function confirmDeleteProject() {
    if (!deleteProject) return;
    setDeleteBusy(true);
    try {
      await removeProjectMutation({ projectId: deleteProject.id });
      toast("Project deleted");
      setDeleteProject(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteProject !== null}
        onClose={() => setDeleteProject(null)}
        title="Delete project?"
        description={
          deleteProject
            ? `“${deleteProject.name}” will be removed. Tasks and notes stay in the workspace but are no longer linked to this project.`
            : ""
        }
        confirmLabel="Delete project"
        variant="danger"
        busy={deleteBusy}
        onConfirm={confirmDeleteProject}
      />

      {createModalOpen && workspaceId ? (
        <ProjectFormModal
          key={createModalKey}
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          workspaceId={workspaceId}
          defaultFolderId={folderFromUrl ?? undefined}
          tags={tags ?? []}
          folders={folders ?? []}
        />
      ) : null}

      <SectionHeader
        title="Projects"
        description="Track delivery, priorities, and ownership across initiatives."
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            New project
          </button>
        }
      />

      <div className="space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search projects…"
          className="w-full max-w-none sm:max-w-md"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:hidden">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Sort
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <SortColumnButton
              label="Status"
              column="status"
              activeColumn={sortColumn}
              direction={sortDir}
              onSort={handleSortClick}
              className="text-[11px] font-semibold uppercase tracking-wide"
            />
            <SortColumnButton
              label="Priority"
              column="priority"
              activeColumn={sortColumn}
              direction={sortDir}
              onSort={handleSortClick}
              className="text-[11px] font-semibold uppercase tracking-wide"
            />
            <SortColumnButton
              label="Due date"
              column="due"
              activeColumn={sortColumn}
              direction={sortDir}
              onSort={handleSortClick}
              className="text-[11px] font-semibold uppercase tracking-wide"
            />
          </div>
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Clear search
            </button>
          ) : null}
        </div>
      </div>

      {sortedProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={filtersActive ? "No projects match" : "No projects yet"}
          description={
            filtersActive
              ? "Try changing search, or clear to see all projects."
              : "Create your first project to organize tasks, dates, and tags."
          }
          action={
            !filtersActive ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                New project
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto_2.5rem] md:gap-4 md:px-4">
            <span>Project</span>
            <SortColumnButton
              label="Status"
              column="status"
              activeColumn={sortColumn}
              direction={sortDir}
              onSort={handleSortClick}
            />
            <SortColumnButton
              label="Priority"
              column="priority"
              activeColumn={sortColumn}
              direction={sortDir}
              onSort={handleSortClick}
            />
            <SortColumnButton
              label="Due date"
              column="due"
              activeColumn={sortColumn}
              direction={sortDir}
              onSort={handleSortClick}
            />
            <span>Tags</span>
            <span className="flex items-center justify-end gap-2 text-right">
              <span>Progress</span>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              ) : null}
            </span>
            <span className="sr-only">Actions</span>
          </div>

          <div className="space-y-2">
            {sortedProjects.map((p) => (
              <ProjectRow
                key={p._id}
                project={p}
                taskCount={taskCounts.get(String(p._id)) ?? 0}
                tagNames={p.tagIds.map((id) => tagMap.get(String(id)) ?? "?")}
                folderPath={
                  p.folderId
                    ? folderPathById.get(String(p.folderId))
                    : undefined
                }
                onDelete={() =>
                  setDeleteProject({ id: p._id, name: p.name })
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
