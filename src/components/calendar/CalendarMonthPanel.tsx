import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  agendaDayStartMs,
  agendaEventDragId,
  agendaMonthDayDropId,
} from "@/components/calendar/agenda-dnd-ids";
import {
  DraggableDueTaskChip,
  type AgendaDueTask,
} from "@/components/calendar/CalendarPanel";
import { useWorkspaceDisplay } from "@/hooks/useWorkspaceDisplay";
import { cn } from "@/lib/cn";
import { addDays, formatShortDate, startOfDay } from "@/lib/dates";

type Block = {
  id: string;
  title: string;
  start: number;
  end: number;
  meta?: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Max task + event rows shown in a month cell before "+N" overflow. */
const MAX_VISIBLE_IN_CELL = 3;

type Props = {
  anchor: Date;
  blocks: Block[];
  dueTasks?: AgendaDueTask[];
  onDayClick?: (day: Date) => void;
  onBlockClick?: (blockId: string) => void;
  onDueTaskClick?: (taskId: string) => void;
  className?: string;
  getBlockDragId?: (blockId: string) => string;
};

type DayDetailState = {
  day: Date;
  tasks: AgendaDueTask[];
  events: Block[];
};

function DraggableMonthEventBlock({
  block,
  onBlockClick,
  getBlockDragId = agendaEventDragId,
}: {
  block: Block;
  onBlockClick?: (blockId: string) => void;
  getBlockDragId?: (blockId: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: getBlockDragId(block.id),
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
        onBlockClick?.(block.id);
      }}
      className={cn(
        "w-full touch-none truncate rounded bg-accent-soft px-1 py-0.5 text-left text-[10px] font-medium text-accent-ink transition hover:bg-accent-soft-mid",
        isDragging ? "cursor-grabbing opacity-40" : "cursor-grab",
      )}
    >
      {block.title}
    </button>
  );
}

function DraggableModalEventRow({
  block,
  onPick,
  getBlockDragId = agendaEventDragId,
}: {
  block: Block;
  onPick: () => void;
  getBlockDragId?: (blockId: string) => string;
}) {
  const { formatTime } = useWorkspaceDisplay();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: getBlockDragId(block.id),
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
        onPick();
      }}
      className={cn(
        "w-full touch-none rounded-xl border border-accent-soft bg-accent-soft px-3 py-2 text-left text-sm font-medium text-accent-ink transition hover:bg-accent-soft-mid",
        isDragging ? "cursor-grabbing opacity-40" : "cursor-grab",
      )}
    >
      <span className="block">{block.title}</span>
      <span className="mt-1 text-xs text-accent-ink-muted">
        {formatTime(block.start)} – {formatTime(block.end)}
      </span>
    </button>
  );
}

function MonthGridCell({
  d,
  month,
  dueTasks,
  blocks,
  onDayClick,
  onDueTaskClick,
  onBlockClick,
  onOpenOverflow,
  getBlockDragId,
}: {
  d: Date;
  month: number;
  dueTasks: AgendaDueTask[];
  blocks: Block[];
  onDayClick?: (day: Date) => void;
  onDueTaskClick?: (taskId: string) => void;
  onBlockClick?: (blockId: string) => void;
  onOpenOverflow: (payload: DayDetailState) => void;
  getBlockDragId?: (blockId: string) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: agendaMonthDayDropId(agendaDayStartMs(d)),
  });
  const inMonth = d.getMonth() === month;
  const dayTasks = dueTasks.filter((t) => {
    const td = new Date(t.dueDate);
    td.setHours(0, 0, 0, 0);
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    return td.getTime() === dd.getTime();
  });
  const dayBlocks = blocks.filter((b) => {
    const bd = new Date(b.start);
    return bd.toDateString() === d.toDateString();
  });
  const total = dayTasks.length + dayBlocks.length;
  const overflow = Math.max(0, total - MAX_VISIBLE_IN_CELL);
  const taskShow = dayTasks.slice(0, MAX_VISIBLE_IN_CELL);
  const slotsLeft = MAX_VISIBLE_IN_CELL - taskShow.length;
  const eventShow = dayBlocks.slice(0, slotsLeft);

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={() => onDayClick?.(startOfDay(d))}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDayClick?.(startOfDay(d));
        }
      }}
      className={cn(
        "min-h-[5.5rem] cursor-pointer bg-white p-1.5 text-left outline-none transition hover:bg-accent-tint focus-visible:ring-2 focus-visible:ring-accent-outline",
        !inMonth && "bg-slate-50/50 text-slate-400",
        inMonth && "text-slate-900",
        isOver && "ring-2 ring-accent-dnd ring-offset-1",
      )}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
          inMonth ? "text-slate-900" : "text-slate-400",
          inMonth &&
            startOfDay(d).getTime() === startOfDay(new Date()).getTime() &&
            "bg-accent-solid text-white",
        )}
      >
        {d.getDate()}
      </span>
      <div className="mt-1 space-y-0.5">
        {taskShow.map((t) => (
          <DraggableDueTaskChip
            key={`t-${t.id}`}
            task={t}
            onDueTaskClick={onDueTaskClick}
          />
        ))}
        {eventShow.map((b) => (
          <DraggableMonthEventBlock
            key={b.id}
            block={b}
            onBlockClick={onBlockClick}
            getBlockDragId={getBlockDragId}
          />
        ))}
        {overflow > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenOverflow({
                day: startOfDay(d),
                tasks: dayTasks,
                events: dayBlocks,
              });
            }}
            className="w-full rounded-md py-0.5 text-center text-[10px] font-semibold text-accent transition hover:bg-accent-soft hover:text-accent-strong"
          >
            +{overflow}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CalendarMonthPanel({
  anchor,
  blocks,
  dueTasks = [],
  onDayClick,
  onBlockClick,
  onDueTaskClick,
  className,
  getBlockDragId = agendaEventDragId,
}: Props) {
  const [dayDetail, setDayDetail] = useState<DayDetailState | null>(null);

  useEffect(() => {
    if (!dayDetail) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDayDetail(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dayDetail]);

  const month = anchor.getMonth();
  const year = anchor.getFullYear();
  const monthStart = new Date(year, month, 1);
  const pad = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -pad);

  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const title = anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">
          {blocks.length} event{blocks.length === 1 ? "" : "s"}
          {dueTasks.length > 0
            ? ` · ${dueTasks.length} task${dueTasks.length === 1 ? "" : "s"} (due)`
            : ""}
        </p>
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-100 p-px">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="bg-slate-50/80 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {w}
          </div>
        ))}
        {days.map((d) => (
          <MonthGridCell
            key={d.toISOString()}
            d={d}
            month={month}
            dueTasks={dueTasks}
            blocks={blocks}
            onDayClick={onDayClick}
            onDueTaskClick={onDueTaskClick}
            onBlockClick={onBlockClick}
            onOpenOverflow={setDayDetail}
            getBlockDragId={getBlockDragId}
          />
        ))}
      </div>

      {dayDetail ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/25 p-4 pt-[12vh] backdrop-blur-sm"
          role="presentation"
          onClick={() => setDayDetail(null)}
        >
          <div
            className="max-h-[min(70vh,480px)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="month-day-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="month-day-detail-title"
                className="text-lg font-semibold text-slate-900"
              >
                {formatShortDate(dayDetail.day.getTime())}
              </h2>
              <button
                type="button"
                onClick={() => setDayDetail(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {dayDetail.tasks.length} task
              {dayDetail.tasks.length === 1 ? "" : "s"} · {dayDetail.events.length}{" "}
              event{dayDetail.events.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-4 space-y-2">
              {dayDetail.tasks.map((t) => (
                <li key={`dt-${t.id}`}>
                  <DraggableDueTaskChip
                    task={t}
                    onDueTaskClick={(id) => {
                      onDueTaskClick?.(id);
                      setDayDetail(null);
                    }}
                    className="!rounded-xl !px-3 !py-2 !text-sm"
                  />
                </li>
              ))}
              {dayDetail.events.map((b) => (
                <li key={`de-${b.id}`}>
                  <DraggableModalEventRow
                    block={b}
                    getBlockDragId={getBlockDragId}
                    onPick={() => {
                      onBlockClick?.(b.id);
                      setDayDetail(null);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
