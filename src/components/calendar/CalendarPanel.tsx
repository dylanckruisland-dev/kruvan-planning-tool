import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { ListTodo } from "lucide-react";
import {
  agendaDayStartMs,
  agendaEventDragId,
  agendaLocalFractionInDay,
  agendaSlotDropId,
  agendaTaskDragId,
  agendaTaskStripDropId,
} from "@/components/calendar/agenda-dnd-ids";
import { cn } from "@/lib/cn";
import {
  addDays,
  formatHourLabel,
  formatShortDate,
  formatTime,
  startOfDay,
  weekStartAnchor,
} from "@/lib/dates";

type Block = {
  id: string;
  title: string;
  start: number;
  end: number;
  meta?: string;
};

/** Task with a due date — shown in the top strip (no time), not in the grid. */
export type AgendaDueTask = {
  id: string;
  title: string;
  dueDate: number;
};

const SLOT_COUNT = 48;
const MINUTES_PER_DAY = 24 * 60;
/** Fixed slot area height; rows use flex so each row = 1/48 of the day. */
const SLOT_AREA_HEIGHT_REM = 84;
/** Same height as day header + spacer column so rows align across the grid */
const DAY_HEADER_CLASS =
  "flex h-14 shrink-0 flex-col items-center justify-center border-b border-slate-100 px-2 py-2 text-center";

const TASK_STRIP_CLASS =
  "max-h-28 min-h-[2.75rem] shrink-0 overflow-y-auto border-b border-slate-100 bg-slate-50/50 px-1 py-1.5";

function slotIndexToClock(s: number): { hour: number; minute: number } {
  const startMin = s * 30;
  return {
    hour: Math.floor(startMin / 60),
    minute: startMin % 60,
  };
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function DraggableDueTaskChip({
  task,
  onDueTaskClick,
  className,
}: {
  task: AgendaDueTask;
  onDueTaskClick?: (taskId: string) => void;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: agendaTaskDragId(task.id),
    });
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onDueTaskClick?.(task.id);
      }}
      className={cn(
        "w-full touch-none truncate rounded-md border border-emerald-200/90 bg-emerald-50 px-1.5 py-1 text-left text-[10px] font-medium text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100/90",
        isDragging && "cursor-grabbing opacity-40",
        !isDragging && "cursor-grab",
        className,
      )}
    >
      {task.title}
    </button>
  );
}

function DraggableEventBlock({
  block,
  day: d,
  onBlockClick,
  formatBlockTime,
  getBlockDragId = agendaEventDragId,
}: {
  block: Block;
  day: Date;
  onBlockClick?: (blockId: string) => void;
  formatBlockTime: (ts: number) => string;
  getBlockDragId?: (blockId: string) => string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: getBlockDragId(block.id),
  });
  const day0 = agendaDayStartMs(d);
  const startFrac = agendaLocalFractionInDay(block.start, day0);
  let endFrac = agendaLocalFractionInDay(block.end, day0);
  if (endFrac < startFrac) endFrac = startFrac;
  const heightFrac = endFrac - startFrac;
  const minDayFrac = 1 / (SLOT_COUNT * 2);
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{
        top: `${startFrac * 100}%`,
        height: `${Math.max(heightFrac * 100, minDayFrac * 100)}%`,
      }}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onBlockClick?.(block.id);
      }}
      className={cn(
        "absolute inset-x-1 z-10 min-w-0 max-w-full cursor-grab touch-none overflow-hidden rounded-lg border border-accent-soft bg-accent-soft px-1.5 py-1 text-left shadow-sm transition hover:border-accent-border hover:bg-accent-soft-mid active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <p className="break-words text-[11px] font-semibold leading-snug text-accent-ink">
        {block.title}
      </p>
      <p className="break-words text-[10px] leading-snug text-accent-ink-muted">
        {formatBlockTime(block.start)} – {formatBlockTime(block.end)}
      </p>
      {block.meta ? (
        <p className="line-clamp-2 break-words text-[10px] text-accent">
          {block.meta}
        </p>
      ) : null}
    </button>
  );
}

function DroppableSlot({
  day,
  slotIndex,
  hour,
  minute,
  borderClass,
  onSlotClick,
}: {
  day: Date;
  slotIndex: number;
  hour: number;
  minute: number;
  borderClass: string;
  onSlotClick?: (day: Date, hour: number, minute: number) => void;
}) {
  const id = agendaSlotDropId(agendaDayStartMs(day), slotIndex);
  const { setNodeRef, isOver } = useDroppable({ id });
  return onSlotClick ? (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSlotClick(day, hour, minute)}
      className={cn(
        "min-h-0 w-full flex-1 basis-0 text-left transition hover:bg-accent-tint focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent-outline",
        borderClass,
        isOver && "bg-accent-soft-mid",
      )}
    />
  ) : (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-0 flex-1 basis-0 transition hover:bg-accent-tint",
        borderClass,
      )}
    />
  );
}

function DroppableTaskStrip({
  day,
  children,
}: {
  day: Date;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: agendaTaskStripDropId(agendaDayStartMs(day)),
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        TASK_STRIP_CLASS,
        isOver && "bg-emerald-100/50 ring-1 ring-emerald-300/60",
      )}
    >
      {children}
    </div>
  );
}

type Props = {
  anchor: Date;
  mode: "day" | "week";
  blocks: Block[];
  /** Tasks with a due date — shown above the time grid, not timed. */
  dueTasks?: AgendaDueTask[];
  onDueTaskClick?: (taskId: string) => void;
  /** Slot start: minute is 0 or 30. */
  onSlotClick?: (day: Date, hour: number, minute: number) => void;
  onBlockClick?: (blockId: string) => void;
  className?: string;
  weekStartsOn?: "sunday" | "monday";
  /** Workspace time prefs for labels. */
  formatTimeDisplay?: (ts: number) => string;
  formatShortDateDisplay?: (ts: number) => string;
  /** Use 12h labels in the hour column. */
  hour12Labels?: boolean;
  /** Defaults to agenda events; use `contentAgendaDragId` for the content calendar. */
  getBlockDragId?: (blockId: string) => string;
};

export function CalendarPanel({
  anchor,
  mode,
  blocks,
  dueTasks = [],
  onDueTaskClick,
  onSlotClick,
  onBlockClick,
  className,
  weekStartsOn = "monday",
  formatTimeDisplay = formatTime,
  formatShortDateDisplay = (ts: number) => formatShortDate(ts),
  hour12Labels = false,
  getBlockDragId = agendaEventDragId,
}: Props) {
  const now = useNow();

  const start =
    mode === "day"
      ? startOfDay(anchor)
      : weekStartAnchor(anchor, weekStartsOn);

  const days =
    mode === "day"
      ? [start]
      : Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => i);

  const todayStr = now.toDateString();
  const minsNow =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const nowTopPct = (minsNow / MINUTES_PER_DAY) * 100;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-medium text-slate-800">
          {mode === "day"
            ? formatShortDateDisplay(start.getTime())
            : `Week of ${formatShortDateDisplay(start.getTime())}`}
        </p>
        <p className="text-xs text-slate-500">
          {blocks.length} event{blocks.length === 1 ? "" : "s"}
          {dueTasks.length > 0
            ? ` · ${dueTasks.length} task${dueTasks.length === 1 ? "" : "s"} (due)`
            : ""}
        </p>
      </div>
      <div className="max-h-[min(70vh,56rem)] overflow-y-auto overscroll-contain">
        <div className="grid min-w-0 grid-cols-[auto_1fr] items-start gap-0">
          <div className="sticky left-0 z-[1] shrink-0 border-r border-slate-200 bg-slate-50">
            <div className={DAY_HEADER_CLASS}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 opacity-0">
                —
              </p>
              <p className="text-sm font-semibold text-slate-900 opacity-0">0</p>
            </div>
            <div
              className={cn(TASK_STRIP_CLASS, "flex items-start justify-end gap-1")}
            >
              <span className="sr-only">Tasks with a due date</span>
              <ListTodo
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                aria-hidden
              />
            </div>
            <div
              className="relative flex min-h-0 flex-col overflow-hidden"
              style={{ height: `${SLOT_AREA_HEIGHT_REM}rem` }}
            >
              {slots.map((s) => {
                const isHourStart = s % 2 === 0;
                const hour = s / 2;
                return (
                  <div
                    key={s}
                    className={cn(
                      "flex min-h-0 flex-1 basis-0 items-start justify-end border-b pr-2 pt-0.5 text-xs font-medium tabular-nums tracking-tight",
                      s % 2 === 1
                        ? "border-slate-300"
                        : "border-dashed border-slate-200/90",
                      isHourStart ? "text-slate-700" : "",
                    )}
                  >
                    {isHourStart ? formatHourLabel(hour, hour12Labels) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className={cn(
              "grid min-w-0 max-w-full gap-px bg-slate-100",
              mode === "day" ? "grid-cols-1" : "grid-cols-7",
            )}
          >
            {days.map((d) => {
              const isToday = d.toDateString() === todayStr;

              return (
                <div
                  key={d.toISOString()}
                  className="min-w-0 overflow-hidden bg-white"
                >
                  <div className={DAY_HEADER_CLASS}>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {d.getDate()}
                    </p>
                  </div>
                  <DroppableTaskStrip day={d}>
                    <div className="flex flex-col gap-1">
                      {dueTasks
                        .filter((t) => {
                          const td = new Date(t.dueDate);
                          td.setHours(0, 0, 0, 0);
                          const dd = new Date(d);
                          dd.setHours(0, 0, 0, 0);
                          return td.getTime() === dd.getTime();
                        })
                        .map((t) => (
                          <DraggableDueTaskChip
                            key={t.id}
                            task={t}
                            onDueTaskClick={onDueTaskClick}
                          />
                        ))}
                    </div>
                  </DroppableTaskStrip>
                  <div
                    className="relative flex min-h-0 min-w-0 flex-col overflow-hidden px-1"
                    style={{ height: `${SLOT_AREA_HEIGHT_REM}rem` }}
                  >
                    {slots.map((s) => {
                      const { hour, minute } = slotIndexToClock(s);
                      const borderClass =
                        s % 2 === 1
                          ? "border-b border-slate-300"
                          : "border-b border-dashed border-slate-200/90";
                      return (
                        <DroppableSlot
                          key={s}
                          day={d}
                          slotIndex={s}
                          hour={hour}
                          minute={minute}
                          borderClass={borderClass}
                          onSlotClick={onSlotClick}
                        />
                      );
                    })}
                    {blocks
                      .filter((b) => {
                        const bd = new Date(b.start);
                        return bd.toDateString() === d.toDateString();
                      })
                      .map((b) => (
                        <DraggableEventBlock
                          key={b.id}
                          block={b}
                          day={d}
                          onBlockClick={onBlockClick}
                          formatBlockTime={formatTimeDisplay}
                          getBlockDragId={getBlockDragId}
                        />
                      ))}
                    {isToday ? (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-30 flex -translate-y-1/2 items-center"
                        style={{ top: `${nowTopPct}%` }}
                        aria-hidden
                      >
                        <div className="h-[3px] w-full rounded-full bg-accent-solid shadow-accent-now-bar" />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
