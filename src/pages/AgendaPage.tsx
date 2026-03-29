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
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { CalendarMonthPanel } from "@/components/calendar/CalendarMonthPanel";
import {
  CalendarPanel,
  type AgendaDueTask,
} from "@/components/calendar/CalendarPanel";
import {
  agendaSlotStartMs,
  parseAgendaDrag,
  parseAgendaDrop,
} from "@/components/calendar/agenda-dnd-ids";
import { EventFormModal } from "@/components/calendar/EventFormModal";
import { useWorkspaceDisplay } from "@/hooks/useWorkspaceDisplay";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  addDays,
  addMonths,
  endOfMonth,
  startOfDay,
  startOfMonth,
  weekStartAnchor,
} from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Calendar, CheckCircle2, Plus } from "lucide-react";
import type { Id } from "@cvx/_generated/dataModel";

type ViewMode = "day" | "week" | "month";

type EventModalState = {
  eventId?: Id<"events">;
  title: string;
  description: string;
  start: number;
  end: number;
  linkedTaskId?: Id<"tasks">;
};

export function AgendaPage() {
  const { workspaceId, workspace } = useWorkspace();
  const {
    formatTime: formatTimeWs,
    formatShortDate: formatShortDateWs,
    weekStartsOn,
    hour12Grid,
  } = useWorkspaceDisplay();
  const navigate = useNavigate();
  const { event: eventFromUrl } = useSearch({ from: "/agenda" });
  const [mode, setMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [upcomingFrom] = useState(() => Date.now());
  const [eventModal, setEventModal] = useState<EventModalState | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    kind: "event" | "task";
    title: string;
  } | null>(null);

  const updateEventMutation = useMutation(api.events.update);
  const updateTaskMutation = useMutation(api.tasks.update);

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

  useEffect(() => {
    if (!workspace) return;
    const d = workspace.defaultAgendaView;
    if (d !== "day" && d !== "week") return;
    setMode((prev) => (prev === "month" ? prev : d));
  }, [workspace?._id, workspace?.defaultAgendaView]);

  const end = useMemo(() => {
    if (mode === "day") return start + 86400000;
    if (mode === "month") return endOfMonth(anchor);
    return start + 7 * 86400000;
  }, [mode, start, anchor]);

  const events = useQuery(
    api.events.listInRange,
    workspaceId ? { workspaceId, start, end } : "skip",
  );

  const dueTasksRaw = useQuery(
    api.tasks.listDueInRange,
    workspaceId ? { workspaceId, start, end } : "skip",
  );

  const dueTasks = useMemo((): AgendaDueTask[] => {
    if (!dueTasksRaw) return [];
    return dueTasksRaw.map((t) => ({
      id: String(t._id),
      title: t.title,
      dueDate: t.dueDate!,
    }));
  }, [dueTasksRaw]);

  const blocks = useMemo(() => {
    return (events ?? []).map((e) => ({
      id: String(e._id),
      title: e.title,
      start: e.startTime,
      end: e.endTime,
      meta: e.description,
    }));
  }, [events]);

  const upcoming = useQuery(
    api.events.listUpcoming,
    workspaceId ? { workspaceId, from: upcomingFrom, limit: 80 } : "skip",
  );

  const workspaceTasks = useQuery(
    api.tasks.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );

  const upcomingTasksSidebar = useMemo(() => {
    if (!workspaceTasks) return [];
    const now = new Date();
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    const t0 = tomorrowStart.getTime();
    const t1 = tomorrowEnd.getTime();

    return workspaceTasks
      .filter((t) => {
        if (t.status === "done" || t.status === "cancelled") return false;
        if (t.dueDate == null) return false;
        const d = new Date(t.dueDate);
        d.setHours(0, 0, 0, 0);
        const dayMs = d.getTime();
        return dayMs >= t0 && dayMs < t1;
      })
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
  }, [workspaceTasks]);

  useEffect(() => {
    if (!eventFromUrl) return;
    const el = document.getElementById(`agenda-event-${eventFromUrl}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [eventFromUrl, upcoming]);

  function defaultNewEventRange(): { start: number; end: number } {
    const base = new Date(anchor);
    const today = new Date();
    const sameDay =
      base.getFullYear() === today.getFullYear() &&
      base.getMonth() === today.getMonth() &&
      base.getDate() === today.getDate();
    let s: Date;
    if (sameDay) {
      s = new Date();
      s.setMinutes(0, 0, 0);
      if (s.getTime() <= Date.now()) {
        s.setHours(s.getHours() + 1);
      }
    } else {
      s = new Date(base);
      s.setHours(9, 0, 0, 0);
    }
    return { start: s.getTime(), end: s.getTime() + 60 * 60 * 1000 };
  }

  function openNewEvent(range?: { start: number; end: number }) {
    const r = range ?? defaultNewEventRange();
    setEventModal({
      title: "",
      description: "",
      start: r.start,
      end: r.end,
    });
  }

  function openEditEvent(blockId: string) {
    const e =
      events?.find((x) => String(x._id) === blockId) ??
      upcoming?.find((x) => String(x._id) === blockId);
    if (!e) return;
    setEventModal({
      eventId: e._id,
      title: e.title,
      description: e.description ?? "",
      start: e.startTime,
      end: e.endTime,
      linkedTaskId: e.taskId,
    });
  }

  function onSlotClick(day: Date, hour: number, minute: number) {
    const s = new Date(day);
    s.setHours(hour, minute, 0, 0);
    const startMs = s.getTime();
    openNewEvent({
      start: startMs,
      /** Half-hour grid: event spans exactly that 30-minute cell. */
      end: startMs + 30 * 60 * 1000,
    });
  }

  function onMonthDayClick(day: Date) {
    const s = new Date(day);
    s.setHours(9, 0, 0, 0);
    openNewEvent({
      start: s.getTime(),
      end: s.getTime() + 60 * 60 * 1000,
    });
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

  function openDueTask(taskId: string) {
    navigate({
      to: "/tasks",
      search: { task: taskId, taskView: undefined },
    });
  }

  function onAgendaDragStart(e: DragStartEvent) {
    const p = parseAgendaDrag(String(e.active.id));
    if (!p) return;
    if (p.kind === "event") {
      const ev =
        events?.find((x) => String(x._id) === p.id) ??
        upcoming?.find((x) => String(x._id) === p.id);
      setDragPreview({ kind: "event", title: ev?.title ?? "Event" });
    } else {
      const t =
        workspaceTasks?.find((x) => String(x._id) === p.id) ??
        dueTasksRaw?.find((x) => String(x._id) === p.id);
      setDragPreview({ kind: "task", title: t?.title ?? "Task" });
    }
  }

  async function onAgendaDragEnd(e: DragEndEvent) {
    setDragPreview(null);
    const { active, over } = e;
    if (!over) return;
    const drag = parseAgendaDrag(String(active.id));
    const drop = parseAgendaDrop(String(over.id));
    if (!drag || !drop) return;

    if (drag.kind === "event") {
      const eventId = drag.id as Id<"events">;
      const ev =
        events?.find((x) => String(x._id) === drag.id) ??
        upcoming?.find((x) => String(x._id) === drag.id);
      if (!ev) return;
      const duration = Math.max(ev.endTime - ev.startTime, 30 * 60 * 1000);

      if (drop.kind === "slot") {
        const startMs = agendaSlotStartMs(drop.dayStartMs, drop.slotIndex);
        const endMs = startMs + duration;
        if (startMs === ev.startTime && endMs === ev.endTime) return;
        await updateEventMutation({
          eventId,
          startTime: startMs,
          endTime: endMs,
        });
      } else if (drop.kind === "taskstrip" || drop.kind === "monthday") {
        const d = new Date(drop.dayStartMs);
        d.setHours(9, 0, 0, 0);
        const startMs = d.getTime();
        const endMs = startMs + duration;
        if (startMs === ev.startTime && endMs === ev.endTime) return;
        await updateEventMutation({
          eventId,
          startTime: startMs,
          endTime: endMs,
        });
      }
      return;
    }

    const taskId = drag.id as Id<"tasks">;
    const task =
      workspaceTasks?.find((x) => String(x._id) === drag.id) ??
      dueTasksRaw?.find((x) => String(x._id) === drag.id);
    if (!task) return;

    if (drop.kind === "slot") {
      const startMs = agendaSlotStartMs(drop.dayStartMs, drop.slotIndex);
      const endMs = startMs + 30 * 60 * 1000;
      await updateTaskMutation({
        taskId,
        dueDate: drop.dayStartMs,
        scheduledStart: startMs,
        scheduledEnd: endMs,
      });
    } else if (drop.kind === "taskstrip" || drop.kind === "monthday") {
      const dueDay =
        task.dueDate != null
          ? (() => {
              const x = new Date(task.dueDate);
              x.setHours(0, 0, 0, 0);
              return x.getTime();
            })()
          : null;
      if (dueDay === drop.dayStartMs && !task.scheduledStart) return;
      await updateTaskMutation({
        taskId,
        dueDate: drop.dayStartMs,
        scheduledStart: null,
        scheduledEnd: null,
      });
    }
  }

  const calendarLoading =
    events === undefined ||
    dueTasksRaw === undefined ||
    workspaceTasks === undefined;

  return (
    <div className="space-y-6">
      {workspaceId && eventModal ? (
        <EventFormModal
          onClose={() => setEventModal(null)}
          workspaceId={workspaceId}
          eventId={eventModal.eventId}
          linkedTaskId={eventModal.linkedTaskId}
          initialTitle={eventModal.title}
          initialDescription={eventModal.description}
          initialStart={eventModal.start}
          initialEnd={eventModal.end}
        />
      ) : null}

      <div className="pb-4">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              Agenda
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Calendar blocks and linked tasks surface together for scheduling.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openNewEvent()}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Add event
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
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
              onDragStart={onAgendaDragStart}
              onDragCancel={() => setDragPreview(null)}
              onDragEnd={(ev) => void onAgendaDragEnd(ev)}
            >
              <div className="min-h-0">
                {mode === "month" ? (
                  <CalendarMonthPanel
                    anchor={anchor}
                    blocks={blocks}
                    dueTasks={dueTasks}
                    onDayClick={onMonthDayClick}
                    onBlockClick={openEditEvent}
                    onDueTaskClick={openDueTask}
                  />
                ) : (
                  <CalendarPanel
                    anchor={anchor}
                    mode={mode}
                    blocks={blocks}
                    dueTasks={dueTasks}
                    onDueTaskClick={openDueTask}
                    onSlotClick={onSlotClick}
                    onBlockClick={openEditEvent}
                    weekStartsOn={weekStartsOn}
                    formatTimeDisplay={formatTimeWs}
                    formatShortDateDisplay={formatShortDateWs}
                    hour12Labels={hour12Grid}
                  />
                )}
              </div>
              <DragOverlay zIndex={10000}>
                {dragPreview ? (
                  <div
                    className={cn(
                      "max-w-xs rounded-lg border px-3 py-2 text-left text-xs font-semibold shadow-lg",
                      dragPreview.kind === "event"
                        ? "border-accent-border bg-accent-soft text-accent-ink"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900",
                    )}
                  >
                    {dragPreview.title}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
            <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Upcoming events
                  </h2>
                  <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
                </div>
                <ul className="space-y-3">
                  {(upcoming ?? []).map((e) => (
                    <li key={e._id} id={`agenda-event-${String(e._id)}`}>
                      <button
                        type="button"
                        onClick={() => openEditEvent(String(e._id))}
                        className={cn(
                          "w-full rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md",
                          eventFromUrl === String(e._id) &&
                            "ring-2 ring-accent-outline ring-offset-2",
                        )}
                      >
                        <p className="font-semibold text-slate-900">{e.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {e.allDay
                            ? formatShortDateWs(e.startTime)
                            : `${formatShortDateWs(e.startTime)} · ${formatTimeWs(e.startTime)} – ${formatTimeWs(e.endTime)}`}
                        </p>
                      </button>
                    </li>
                  ))}
                  {(upcoming ?? []).length === 0 ? (
                    <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">
                      No upcoming events.
                    </li>
                  ) : null}
                </ul>
              </section>

              <section>
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Upcoming tasks
                  </h2>
                  <CheckCircle2 className="h-4 w-4 text-slate-400" aria-hidden />
                </div>
                <p className="mb-3 text-xs text-slate-500">Due tomorrow</p>
                <ul className="space-y-3">
                  {upcomingTasksSidebar.map((t) => (
                    <li key={t._id}>
                      <Link
                        to="/tasks"
                        search={{ task: String(t._id), taskView: undefined }}
                        className="block rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                      >
                        <p className="font-semibold text-slate-900">{t.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Due {formatShortDateWs(t.dueDate!)}
                        </p>
                      </Link>
                    </li>
                  ))}
                  {upcomingTasksSidebar.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">
                      No tasks due tomorrow.
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
