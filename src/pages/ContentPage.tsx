import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { ContentAgendaView } from "@/components/content/ContentAgendaView";
import { ContentPlanBoard } from "@/components/content/ContentPlanBoard";
import { ContentPlanModal } from "@/components/content/ContentPlanModal";
import { GenerateContentIdeasModal } from "@/components/content/GenerateContentIdeasModal";
import { PlanAttachmentHint } from "@/components/content/PlanAttachmentHint";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  CONTENT_PLATFORM_LABEL,
  CONTENT_STATUS_ORDER,
  isImageContentType,
  type ContentPlatform,
  type ContentStatus,
} from "@/lib/content-plan";
import { cn } from "@/lib/cn";
import { formatShortDate, formatTime } from "@/lib/dates";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { CalendarClock, Clapperboard, LayoutGrid, Plus, Sparkles } from "lucide-react";

type PlatformFilter = "all" | ContentPlatform;

function groupByStatus(
  items: Doc<"contentPlans">[],
): Record<ContentStatus, Doc<"contentPlans">[]> {
  const init = {} as Record<ContentStatus, Doc<"contentPlans">[]>;
  for (const s of CONTENT_STATUS_ORDER) init[s] = [];
  for (const item of items) {
    init[item.status].push(item);
  }
  for (const s of CONTENT_STATUS_ORDER) {
    init[s].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return init;
}

function upcomingInSevenDays(items: Doc<"contentPlans">[]) {
  const now = Date.now();
  const end = now + 7 * 24 * 60 * 60 * 1000;
  return items
    .filter(
      (i) =>
        i.scheduledFor != null &&
        i.scheduledFor >= now &&
        i.scheduledFor <= end &&
        i.status !== "published" &&
        i.status !== "skipped",
    )
    .sort((a, b) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0));
}

export function ContentPage() {
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate({ from: "/content" });
  const { content: contentFromUrl, view: viewFromUrl } = useSearch({
    from: "/content",
  });
  const viewMode = viewFromUrl === "calendar" ? "calendar" : "board";
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlan, setModalPlan] = useState<Doc<"contentPlans"> | null>(null);
  const [createStatus, setCreateStatus] = useState<ContentStatus>("idea");
  const [createPresetScheduledFor, setCreatePresetScheduledFor] = useState<
    number | undefined
  >(undefined);
  const [generateIdeasOpen, setGenerateIdeasOpen] = useState(false);

  const projects = useQuery(
    api.projects.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );

  const projectOptions = useMemo(() => {
    if (!projects?.length) return [];
    return [...projects]
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      )
      .map((p) => ({ _id: String(p._id), name: p.name }));
  }, [projects]);

  const items = useQuery(
    api.contentPlans.listByWorkspace,
    workspaceId
      ? {
          workspaceId,
          search: search.trim() || undefined,
          platform:
            platformFilter === "all" ? undefined : platformFilter,
        }
      : "skip",
  );

  const grouped = useMemo(
    () => (items ? groupByStatus(items) : null),
    [items],
  );

  const upcoming = useMemo(
    () => (items ? upcomingInSevenDays(items) : []),
    [items],
  );

  const firstImageByPlan = useMemo(() => {
    const m = new Map<string, Id<"_storage">>();
    if (!items) return m;
    for (const plan of items) {
      const att = plan.attachments?.find((a) =>
        isImageContentType(a.contentType),
      );
      if (att) m.set(String(plan._id), att.storageId);
    }
    return m;
  }, [items]);

  const imageStorageIds = useMemo(
    () => Array.from(new Set(firstImageByPlan.values())),
    [firstImageByPlan],
  );

  const imageUrlRows = useQuery(
    api.contentPlans.getAttachmentUrls,
    imageStorageIds.length > 0 ? { storageIds: imageStorageIds } : "skip",
  );

  const imageUrlByPlanId = useMemo(() => {
    const m = new Map<string, string>();
    if (!imageUrlRows) return m;
    const urlByStorage = new Map<string, string>();
    for (const row of imageUrlRows) {
      if (row.url) urlByStorage.set(String(row.storageId), row.url);
    }
    for (const [planId, sid] of firstImageByPlan) {
      const u = urlByStorage.get(String(sid));
      if (u) m.set(planId, u);
    }
    return m;
  }, [imageUrlRows, firstImageByPlan]);

  useEffect(() => {
    if (!contentFromUrl || !items) return;
    const found = items.find((i) => String(i._id) === contentFromUrl);
    if (found) {
      setModalPlan((prev) =>
        prev && String(prev._id) === String(found._id) ? prev : found,
      );
      setModalOpen(true);
    }
  }, [contentFromUrl, items]);

  function closeModal() {
    setModalOpen(false);
    setModalPlan(null);
    setCreatePresetScheduledFor(undefined);
    void navigate({
      to: "/content",
      search: (prev) => ({ ...prev, content: undefined }),
    });
  }

  function openCreate(status: ContentStatus) {
    void navigate({
      to: "/content",
      search: (prev) => ({ ...prev, content: undefined }),
    });
    setCreateStatus(status);
    setCreatePresetScheduledFor(undefined);
    setModalPlan(null);
    setModalOpen(true);
  }

  function openEdit(plan: Doc<"contentPlans">) {
    setModalPlan(plan);
    setCreatePresetScheduledFor(undefined);
    setModalOpen(true);
    void navigate({
      to: "/content",
      search: (prev) => ({ ...prev, content: String(plan._id) }),
    });
  }

  function openCreateFromCalendar(scheduledFor: number) {
    void navigate({
      to: "/content",
      search: (prev) => ({ ...prev, content: undefined, view: "calendar" }),
    });
    setCreateStatus("scheduled");
    setCreatePresetScheduledFor(scheduledFor);
    setModalPlan(null);
    setModalOpen(true);
  }

  function setContentView(next: "board" | "calendar") {
    void navigate({
      to: "/content",
      search: (prev) => ({
        ...prev,
        view: next === "calendar" ? "calendar" : undefined,
        content: undefined,
      }),
    });
  }

  const listLoading = items === undefined;

  if (!workspaceId) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />;
  }

  return (
    <div className="space-y-6">
      <ContentPlanModal
        open={modalOpen}
        onClose={closeModal}
        plan={modalPlan}
        workspaceId={workspaceId}
        createInitialStatus={createStatus}
        createPresetScheduledFor={createPresetScheduledFor}
        projects={projectOptions}
      />
      <GenerateContentIdeasModal
        open={generateIdeasOpen}
        onClose={() => setGenerateIdeasOpen(false)}
        workspaceId={workspaceId}
      />

      <SectionHeader
        title="Content"
        description="Plan social posts: capture ideas, draft copy, schedule drops, and log what went live—all in one workspace."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="inline-flex shrink-0 rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setContentView("board")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                viewMode === "board"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              type="button"
              onClick={() => setContentView("calendar")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                viewMode === "calendar"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Calendar
            </button>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search titles and notes…"
            className="max-w-md"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="shrink-0 font-medium">Platform</span>
            <select
              value={platformFilter}
              onChange={(e) =>
                setPlatformFilter(e.target.value as PlatformFilter)
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none input-focus-accent"
            >
              <option value="all">All platforms</option>
              {(Object.keys(CONTENT_PLATFORM_LABEL) as ContentPlatform[]).map(
                (p) => (
                  <option key={p} value={p}>
                    {CONTENT_PLATFORM_LABEL[p]}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setGenerateIdeasOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            Generate content
          </button>
          <button
            type="button"
            onClick={() => openCreate("idea")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            New content
          </button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <ContentAgendaView
          workspaceId={workspaceId}
          workspacePlans={items}
          onOpenPlan={openEdit}
          onNewContent={({ scheduledFor }) =>
            openCreateFromCalendar(scheduledFor)
          }
        />
      ) : listLoading ? (
        <div className="min-h-[min(60vh,420px)] animate-pulse rounded-2xl bg-slate-200" />
      ) : (
        <>
          {upcoming.length > 0 ? (
            <section className="rounded-2xl border border-accent-soft bg-accent-tint px-4 py-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-accent-ink">
                <CalendarClock className="h-4 w-4 text-accent" aria-hidden />
                Next 7 days
              </div>
              <ul className="space-y-2">
                {upcoming.map((i) => (
                  <li key={String(i._id)}>
                    <button
                      type="button"
                      onClick={() => openEdit(i)}
                      className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{i.title}</p>
                        <PlanAttachmentHint
                          plan={i}
                          imageUrl={imageUrlByPlanId.get(String(i._id))}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        {i.scheduledFor != null
                          ? `${formatShortDate(i.scheduledFor)} · ${formatTime(i.scheduledFor)}`
                          : "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              icon={Clapperboard}
              title="No content yet"
              description="Add ideas, drafts, and scheduled posts to keep your social pipeline visible."
              action={
                <button
                  type="button"
                  onClick={() => openCreate("idea")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New content
                </button>
              }
            />
          ) : grouped ? (
            <div className="overflow-x-auto pb-2">
              <ContentPlanBoard
                items={items}
                grouped={grouped}
                imageUrlByPlanId={imageUrlByPlanId}
                onOpenEdit={openEdit}
                onAdd={(status) => {
                  void navigate({
                    to: "/content",
                    search: (prev) => ({ ...prev, content: undefined }),
                  });
                  setCreateStatus(status);
                  setModalPlan(null);
                  setModalOpen(true);
                }}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
