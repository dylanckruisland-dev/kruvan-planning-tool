import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { CalendarMonthPanel } from "@/components/calendar/CalendarMonthPanel";
import { CalendarPanel } from "@/components/calendar/CalendarPanel";
import {
  agendaSlotStartMs,
  contentAgendaDragId,
  parseAgendaDrop,
  parseContentAgendaDrag,
} from "@/components/calendar/agenda-dnd-ids";
import { useWorkspaceDisplay } from "@/hooks/useWorkspaceDisplay";
import {
  addDays,
  addMonths,
  endOfMonth,
  startOfDay,
  startOfMonth,
  weekStartAnchor,
} from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { Calendar } from "lucide-react";

const CONTENT_BLOCK_MS = 60 * 60 * 1000;

type ViewMode = "day" | "week" | "month";

type Props = {
  workspaceId: Id<"workspaces">;
  /** Used for the “Upcoming” sidebar; optional while parent loads. */
  workspacePlans?: Doc<"contentPlans">[] | undefined;
  onOpenPlan: (plan: Doc<"contentPlans">) => void;
  onNewContent: (opts: { scheduledFor: number }) => void;
};

export function ContentAgendaView({
  workspaceId,
  workspacePlans,
  onOpenPlan,
  onNewContent,
}: Props) {
  const updatePlan = useMutation(api.contentPlans.update);
  const {
    formatTime: formatTimeWs,
    formatShortDate: formatShortDateWs,
    weekStartsOn,
    hour12Grid,
  } = useWorkspaceDisplay();

  const [mode, setMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [dragTitle, setDragTitle] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const start = useMemo(() => {
    const d = startOfDay(anchor);
    if (mode === "day") return d.getTime();
    if (mode === "month") return startOfMonth(anchor).getTime();
    return weekStartAnchor(anchor, weekStartsOn).getTime();
  }, [anchor, mode, weekStartsOn]);

  const end = useMemo(() => {
    if (mode === "day") return start + 86400000;
    if (mode === "month") return endOfMonth(anchor);
    return start + 7 * 86400000;
  }, [mode, start, anchor]);

  const scheduledInRange = useQuery(
    api.contentPlans.listScheduledInRange,
    { workspaceId, start, end },
  );

  const [upcomingNow, setUpcomingNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setUpcomingNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const blocks = useMemo(() => {
    if (!scheduledInRange) return [];
    return scheduledInRange.map((p) => {
      const s = p.scheduledFor!;
      return {
        id: String(p._id),
        title: p.title,
        start: s,
        end: s + CONTENT_BLOCK_MS,
        meta: p.notes?.trim() || undefined,
      };
    });
  }, [scheduledInRange]);

  const upcomingSidebar = useMemo(() => {
    if (!workspacePlans) return [];
    return [...workspacePlans]
      .filter((p) => p.scheduledFor != null && p.scheduledFor >= upcomingNow)
      .sort((a, b) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0))
      .slice(0, 20);
  }, [workspacePlans, upcomingNow]);

  function onSlotClick(day: Date, hour: number, minute: number) {
    const s = new Date(day);
    s.setHours(hour, minute, 0, 0);
    onNewContent({ scheduledFor: s.getTime() });
  }

  function onMonthDayClick(day: Date) {
    const s = new Date(day);
    s.setHours(9, 0, 0, 0);
    onNewContent({ scheduledFor: s.getTime() });
  }

  function goPrev() {
    setAnchor((d) => {
      if (mode === "day") return addDays(d, -1);
      if (mode === "week") return addDays(d, -7);
      return addMonths(d, -1);
    });
  }

  function goNext() {
    setAnchor((d) => {
      if (mode === "day") return addDays(d, 1);
      if (mode === "week") return addDays(d, 7);
      return addMonths(d, 1);
    });
  }

  function onContentDragStart(e: DragStartEvent) {
    const p = parseContentAgendaDrag(String(e.active.id));
    if (!p) return;
    const plan = scheduledInRange?.find((x) => String(x._id) === p.id);
    setDragTitle(plan?.title ?? "Content");
  }

  async function onContentDragEnd(e: DragEndEvent) {
    setDragTitle(null);
    const { active, over } = e;
    if (!over) return;
    const drag = parseContentAgendaDrag(String(active.id));
    const drop = parseAgendaDrop(String(over.id));
    if (!drag || !drop) return;
    const plan = scheduledInRange?.find((x) => String(x._id) === drag.id);
    if (!plan?.scheduledFor) return;

    if (drop.kind === "slot") {
      const startMs = agendaSlotStartMs(drop.dayStartMs, drop.slotIndex);
      if (startMs === plan.scheduledFor) return;
      await updatePlan({
        contentPlanId: plan._id,
        scheduledFor: startMs,
      });
      return;
    }

    if (drop.kind === "taskstrip" || drop.kind === "monthday") {
      const d = new Date(drop.dayStartMs);
      d.setHours(9, 0, 0, 0);
      const startMs = d.getTime();
      if (startMs === plan.scheduledFor) return;
      await updatePlan({
        contentPlanId: plan._id,
        scheduledFor: startMs,
      });
    }
  }

  const calendarLoading = scheduledInRange === undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="inline-flex shrink-0 rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMode("day")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                mode === "day"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setMode("week")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                mode === "week"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setMode("month")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                mode === "month"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              Month
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Anchor {formatShortDateWs(anchor.getTime())}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[2fr_1fr]">
        {calendarLoading ? (
          <>
            <div className="min-h-[min(70vh,56rem)] animate-pulse rounded-2xl bg-slate-200" />
            <div className="min-h-[min(70vh,56rem)] animate-pulse rounded-2xl bg-slate-200" />
          </>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onContentDragStart}
              onDragCancel={() => setDragTitle(null)}
              onDragEnd={(ev) => void onContentDragEnd(ev)}
            >
              <div className="min-h-0">
                {mode === "month" ? (
                  <CalendarMonthPanel
                    anchor={anchor}
                    blocks={blocks}
                    dueTasks={[]}
                    onDayClick={onMonthDayClick}
                    onBlockClick={(id) => {
                      const p = scheduledInRange?.find(
                        (x) => String(x._id) === id,
                      );
                      if (p) onOpenPlan(p);
                    }}
                    getBlockDragId={contentAgendaDragId}
                  />
                ) : (
                  <CalendarPanel
                    anchor={anchor}
                    mode={mode}
                    blocks={blocks}
                    dueTasks={[]}
                    onSlotClick={onSlotClick}
                    onBlockClick={(id) => {
                      const p = scheduledInRange?.find(
                        (x) => String(x._id) === id,
                      );
                      if (p) onOpenPlan(p);
                    }}
                    weekStartsOn={weekStartsOn}
                    formatTimeDisplay={formatTimeWs}
                    formatShortDateDisplay={formatShortDateWs}
                    hour12Labels={hour12Grid}
                    getBlockDragId={contentAgendaDragId}
                  />
                )}
              </div>
              <DragOverlay zIndex={10000}>
                {dragTitle ? (
                  <div className="max-w-xs rounded-lg border border-accent-border bg-accent-soft px-3 py-2 text-left text-xs font-semibold text-accent-ink shadow-lg">
                    {dragTitle}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Upcoming content
                    </h2>
                    <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
                  </div>
                  <ul className="space-y-3">
                    {upcomingSidebar.map((p) => (
                      <li key={String(p._id)}>
                        <button
                          type="button"
                          onClick={() => onOpenPlan(p)}
                          className="w-full rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
                        >
                          <p className="font-semibold text-slate-900">
                            {p.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {p.scheduledFor != null
                              ? `${formatShortDateWs(p.scheduledFor)} · ${formatTimeWs(p.scheduledFor)}`
                              : "—"}
                          </p>
                        </button>
                      </li>
                    ))}
                    {upcomingSidebar.length === 0 ? (
                      <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">
                        No upcoming scheduled content.
                      </li>
                    ) : null}
                  </ul>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
