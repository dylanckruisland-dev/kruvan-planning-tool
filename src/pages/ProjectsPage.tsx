import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { ProjectRow } from "@/components/projects/ProjectRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterDropdown } from "@/components/ui/FilterDropdown";
import { SearchInput } from "@/components/ui/SearchInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useToast } from "@/contexts/ToastContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Id } from "@cvx/_generated/dataModel";
import { FolderKanban, X } from "lucide-react";

export function ProjectsPage() {
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();
  const { project: projectFromUrl, folder: folderFromUrl } = useSearch({
    from: "/projects",
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [tagId, setTagId] = useState<string>("all");
  const [due, setDue] = useState<string>("all");
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
      status:
        status === "all"
          ? undefined
          : (status as "planning" | "active" | "on_hold" | "done"),
      priority:
        priority === "all"
          ? undefined
          : (priority as "low" | "medium" | "high" | "urgent"),
      tagId:
        tagId === "all" ? undefined : (tagId as Id<"tags">),
      dueFilter:
        due === "all"
          ? undefined
          : (due as "no_date" | "overdue" | "next7"),
    };
  }, [workspaceId, folderFromUrl, search, status, priority, tagId, due]);

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

  const filtersActive = useMemo(() => {
    return (
      status !== "all" ||
      priority !== "all" ||
      tagId !== "all" ||
      due !== "all" ||
      search.trim().length > 0
    );
  }, [status, priority, tagId, due, search]);

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

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setPriority("all");
    setTagId("all");
    setDue("all");
  }

  function openCreateModal() {
    setCreateModalKey((k) => k + 1);
    setCreateModalOpen(true);
  }

  if (!workspaceId || projects === undefined) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />;
  }

  const tagOptions = [
    { value: "all", label: "All tags" },
    ...(tags ?? []).map((t) => ({
      value: String(t._id),
      label: t.name,
    })),
  ];

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
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label="Status"
            value={status}
            onChange={setStatus}
            menuAlign="left"
            options={[
              { value: "all", label: "All statuses" },
              { value: "planning", label: "Planning" },
              { value: "active", label: "Active" },
              { value: "on_hold", label: "On hold" },
              { value: "done", label: "Done" },
            ]}
          />
          <FilterDropdown
            label="Priority"
            value={priority}
            onChange={setPriority}
            menuAlign="left"
            options={[
              { value: "all", label: "All priorities" },
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "urgent", label: "Urgent" },
            ]}
          />
          <FilterDropdown
            label="Tags"
            value={tagId}
            onChange={setTagId}
            menuAlign="left"
            options={tagOptions}
          />
          <FilterDropdown
            label="Due"
            value={due}
            onChange={setDue}
            menuAlign="left"
            options={[
              { value: "all", label: "All due dates" },
              { value: "no_date", label: "No due date" },
              { value: "overdue", label: "Overdue" },
              { value: "next7", label: "Due in next 7 days" },
            ]}
          />
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={filtersActive ? "No projects match" : "No projects yet"}
          description={
            filtersActive
              ? "Try changing filters or search, or clear filters to see all projects."
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
            <span>Status</span>
            <span>Priority</span>
            <span>Due</span>
            <span>Tags</span>
            <span className="text-right">Progress</span>
            <span className="sr-only">Actions</span>
          </div>

          <div className="space-y-2">
            {projects.map((p) => (
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
