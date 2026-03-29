import { useMemo, useState } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { ContentPlanBoardCard } from "@/components/content/ContentPlanBoardCard";
import { ContentPlanModal } from "@/components/content/ContentPlanModal";
import { NoteCard } from "@/components/notes/NoteCard";
import { NoteEditModal } from "@/components/notes/NoteEditModal";
import { SearchInput } from "@/components/ui/SearchInput";
import { ProjectForm } from "@/components/projects/ProjectForm";
import {
  projectToFormValues,
  type ProjectFormValues,
} from "@/lib/project-form";
import { ProjectTaskViews } from "@/components/tasks/ProjectTaskViews";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { dateInputValueToTimestamp } from "@/lib/dates";
import { isImageContentType } from "@/lib/content-plan";
import {
  noteCreatedRange,
  type NoteDatePreset,
} from "@/lib/note-filters";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { ChevronRight } from "lucide-react";

const routeApi = getRouteApi("/projects/$projectId");

const TABS = [
  { id: "overview" as const, label: "Overview" },
  { id: "tasks" as const, label: "Tasks" },
  { id: "notes" as const, label: "Notes" },
  { id: "content" as const, label: "Content" },
];

export function ProjectDetailPage() {
  const { projectId } = routeApi.useParams();
  const { tab: tabRaw, taskView: taskViewRaw } = routeApi.useSearch();
  const tab = tabRaw ?? "overview";
  const taskView: "list" | "board" =
    taskViewRaw === "board" ? "board" : "list";
  const { workspaceId } = useWorkspace();
  const pid = projectId as Id<"projects">;

  const project = useQuery(api.projects.get, { projectId: pid });
  const folders = useQuery(
    api.folders.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const tasks = useQuery(
    api.tasks.listByWorkspace,
    workspaceId ? { workspaceId, projectId: pid } : "skip",
  );
  const [noteSearch, setNoteSearch] = useState("");
  const [noteDatePreset, setNoteDatePreset] =
    useState<NoteDatePreset>("all");
  const [contentSearch, setContentSearch] = useState("");
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [contentModalPlan, setContentModalPlan] = useState<
    Doc<"contentPlans"> | null
  >(null);

  const projectNotesQueryArgs = useMemo(() => {
    if (!workspaceId || tab !== "notes") return null;
    const range = noteCreatedRange(noteDatePreset);
    return {
      workspaceId,
      projectId: pid,
      search: noteSearch.trim() || undefined,
      ...range,
    };
  }, [workspaceId, tab, pid, noteSearch, noteDatePreset]);

  const notes = useQuery(
    api.notes.listByWorkspace,
    projectNotesQueryArgs ?? "skip",
  );

  const contentQueryArgs = useMemo(() => {
    if (!workspaceId || tab !== "content") return null;
    return {
      workspaceId,
      projectId: pid,
      search: contentSearch.trim() || undefined,
    };
  }, [workspaceId, tab, pid, contentSearch]);

  const projectContentPlans = useQuery(
    api.contentPlans.listByWorkspace,
    contentQueryArgs ?? "skip",
  );

  const contentFirstImageByPlan = useMemo(() => {
    const m = new Map<string, Id<"_storage">>();
    if (!projectContentPlans) return m;
    for (const plan of projectContentPlans) {
      const att = plan.attachments?.find((a) =>
        isImageContentType(a.contentType),
      );
      if (att) m.set(String(plan._id), att.storageId);
    }
    return m;
  }, [projectContentPlans]);

  const contentImageStorageIds = useMemo(
    () => Array.from(new Set(contentFirstImageByPlan.values())),
    [contentFirstImageByPlan],
  );

  const contentImageUrlRows = useQuery(
    api.contentPlans.getAttachmentUrls,
    tab === "content" && contentImageStorageIds.length > 0
      ? { storageIds: contentImageStorageIds }
      : "skip",
  );

  const contentImageUrlByPlanId = useMemo(() => {
    const m = new Map<string, string>();
    if (!contentImageUrlRows) return m;
    const urlByStorage = new Map<string, string>();
    for (const row of contentImageUrlRows) {
      if (row.url) urlByStorage.set(String(row.storageId), row.url);
    }
    for (const [planId, sid] of contentFirstImageByPlan) {
      const u = urlByStorage.get(String(sid));
      if (u) m.set(planId, u);
    }
    return m;
  }, [contentImageUrlRows, contentFirstImageByPlan]);
  const overview = useQuery(
    api.dashboard.getOverview,
    workspaceId ? { workspaceId } : "skip",
  );

  const updateProject = useMutation(api.projects.update);
  const [saveBusy, setSaveBusy] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteBeingEdited, setNoteBeingEdited] = useState<Doc<"notes"> | null>(
    null,
  );

  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of overview?.workspaceMembers ?? []) {
      m.set(String(mem._id), mem.name);
    }
    return m;
  }, [overview?.workspaceMembers]);

  const legacyUserName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of overview?.users ?? []) {
      m.set(String(u._id), u.name ?? "");
    }
    return m;
  }, [overview?.users]);

  const tagMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of overview?.tags ?? []) {
      m.set(String(t._id), t.name);
    }
    return m;
  }, [overview?.tags]);

  const formInitial = useMemo(() => {
    if (!project) return null;
    return projectToFormValues(project);
  }, [project]);

  async function onSaveProject(values: ProjectFormValues) {
    setSaveBusy(true);
    try {
      await updateProject({
        projectId: pid,
        name: values.name,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        dueDate: values.dueDate
          ? dateInputValueToTimestamp(values.dueDate)
          : null,
        folderId: values.folderId
          ? (values.folderId as Id<"folders">)
          : null,
        tagIds: values.tagIds.map((x) => x as Id<"tags">),
        progress: values.progress,
      });
    } finally {
      setSaveBusy(false);
    }
  }

  if (!workspaceId || project === undefined) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />;
  }

  if (project === null) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Project not found.
        <div className="mt-4">
          <Link
            to="/projects"
            search={{ project: undefined, folder: undefined }}
            className="font-medium text-accent hover:text-accent-strong hover:underline"
          >
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500"
        >
          <Link
            to="/projects"
            search={{ project: undefined, folder: undefined }}
            className="font-medium transition hover:text-slate-800"
          >
            Projects
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
          <span className="min-w-0 truncate font-medium text-slate-800">
            {project.name}
          </span>
        </nav>
        <SectionHeader
          title={project.name}
          description={
            project.description?.trim()
              ? project.description
              : "Project workspace — edit details on the Overview tab."
          }
        />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-px">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Link
              key={t.id}
              to="/projects/$projectId"
              params={{ projectId: String(pid) }}
              search={{
                tab: t.id,
                taskView: t.id === "tasks" ? taskView : "list",
              }}
              className={cn(
                "rounded-t-lg px-4 py-2 text-sm font-medium transition",
                active
                  ? "bg-white text-accent-ink shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "overview" && formInitial ? (
        <div className="max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Project details
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Update the name, description, status, priority, due date, folder,
            tags, and progress.
          </p>
          <div className="mt-5">
            <ProjectForm
              initial={formInitial}
              workspaceId={workspaceId ?? undefined}
              tags={(overview?.tags ?? []).map((t) => ({
                _id: String(t._id),
                name: t.name,
              }))}
              folders={(folders ?? []).map((f) => ({
                _id: String(f._id),
                name: f.name,
              }))}
              onSubmit={onSaveProject}
              submitLabel="Save changes"
              busy={saveBusy}
              showProgress
              idPrefix="edit-project"
            />
          </div>
        </div>
      ) : null}

      {tab === "tasks" && workspaceId ? (
        <ProjectTaskViews
          projectId={pid}
          workspaceId={workspaceId}
          projectName={project.name}
          tasks={tasks}
          taskView={taskView}
          memberName={memberName}
          legacyUserName={legacyUserName}
          tagMap={tagMap}
          workspaceMembers={overview?.workspaceMembers ?? []}
          tags={overview?.tags ?? []}
        />
      ) : null}

      {tab === "notes" && workspaceId ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
              <SearchInput
                value={noteSearch}
                onChange={setNoteSearch}
                placeholder="Search notes…"
                className="w-full max-w-sm sm:w-72 sm:max-w-none"
              />
              <label className="flex w-full min-w-0 shrink-0 flex-col gap-0.5 text-xs font-medium text-slate-600 sm:w-44">
                Created
                <select
                  value={noteDatePreset}
                  onChange={(e) =>
                    setNoteDatePreset(e.target.value as NoteDatePreset)
                  }
                  className="w-full cursor-pointer rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm outline-none transition input-focus-accent"
                >
                  <option value="all">Any time</option>
                  <option value="today">Today</option>
                  <option value="last7">Last 7 days</option>
                  <option value="last30">Last 30 days</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                setNoteBeingEdited(null);
                setNoteModalOpen(true);
              }}
              className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Add note
            </button>
          </div>

          {notes === undefined ? (
            <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
          ) : !notes.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center sm:col-span-2">
              <p className="text-sm text-slate-600">
                {noteSearch.trim() || noteDatePreset !== "all"
                  ? "No notes match your search or date filter. Try adjusting filters or clear them."
                  : "No notes yet. Create one to keep research and decisions in one place."}
              </p>
              {!noteSearch.trim() && noteDatePreset === "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setNoteBeingEdited(null);
                    setNoteModalOpen(true);
                  }}
                  className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Add note
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNoteSearch("");
                    setNoteDatePreset("all");
                  }}
                  className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {notes.map((n) => (
                <NoteCard
                  key={n._id}
                  note={n}
                  selected={
                    noteModalOpen &&
                    noteBeingEdited !== null &&
                    String(noteBeingEdited._id) === String(n._id)
                  }
                  onClick={() => {
                    setNoteBeingEdited(n);
                    setNoteModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          <NoteEditModal
            open={noteModalOpen}
            onClose={() => {
              setNoteModalOpen(false);
              setNoteBeingEdited(null);
            }}
            note={noteBeingEdited}
            workspaceId={workspaceId}
            projectId={pid}
            projectName={project.name}
          />
        </div>
      ) : null}

      {tab === "content" && workspaceId ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={contentSearch}
              onChange={setContentSearch}
              placeholder="Search titles and notes…"
              className="w-full max-w-sm sm:w-72 sm:max-w-none"
            />
            <button
              type="button"
              onClick={() => {
                setContentModalPlan(null);
                setContentModalOpen(true);
              }}
              className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Add content
            </button>
          </div>

          {projectContentPlans === undefined ? (
            <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
          ) : !projectContentPlans.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center sm:col-span-2">
              <p className="text-sm text-slate-600">
                {contentSearch.trim()
                  ? "No content matches your search. Try adjusting or clear the search."
                  : "No content linked to this project yet. Add content from here or assign this project when creating content on the Content page."}
              </p>
              {!contentSearch.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setContentModalPlan(null);
                    setContentModalOpen(true);
                  }}
                  className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Add content
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setContentSearch("")}
                  className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {projectContentPlans.map((plan) => (
                <ContentPlanBoardCard
                  key={plan._id}
                  plan={plan}
                  imageUrl={contentImageUrlByPlanId.get(String(plan._id))}
                  draggable={false}
                  onOpen={() => {
                    setContentModalPlan(plan);
                    setContentModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      <ContentPlanModal
        open={contentModalOpen}
        onClose={() => {
          setContentModalOpen(false);
          setContentModalPlan(null);
        }}
        plan={contentModalPlan}
        workspaceId={workspaceId}
        lockProjectId={pid}
        lockProjectName={project.name}
      />
    </div>
  );
}
