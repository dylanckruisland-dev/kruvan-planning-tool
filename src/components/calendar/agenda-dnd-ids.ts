/** Stable drag/drop ids for agenda calendar (day/week/month). */

const MS_PER_LOCAL_DAY = 24 * 60 * 60 * 1000;

export function agendaDayStartMs(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Vertical position in the 24h grid (0–1). Uses local wall-clock time from
 * midnight, not raw ms, so DST spring-forward days still place 6:00 at 6/24.
 */
export function agendaLocalFractionInDay(ts: number, day0: number) {
  const next = new Date(day0);
  next.setDate(next.getDate() + 1);
  const nextMidnight = next.getTime();
  if (ts <= day0) return 0;
  if (ts >= nextMidnight) return 1;
  const t = new Date(ts);
  const fromMidnight =
    t.getHours() * 3600000 +
    t.getMinutes() * 60000 +
    t.getSeconds() * 1000 +
    t.getMilliseconds();
  return fromMidnight / MS_PER_LOCAL_DAY;
}

export function agendaEventDragId(eventId: string) {
  return `agenda-event:${eventId}`;
}

/** Content calendar blocks — distinct from agenda events so DnD handlers stay separate. */
export function contentAgendaDragId(planId: string) {
  return `content-agenda:${planId}`;
}

export function parseContentAgendaDrag(
  activeId: string,
): { id: string } | null {
  const prefix = "content-agenda:";
  if (!activeId.startsWith(prefix)) return null;
  return { id: activeId.slice(prefix.length) };
}

export function agendaTaskDragId(taskId: string) {
  return `agenda-task:${taskId}`;
}

export function agendaSlotDropId(dayStartMs: number, slotIndex: number) {
  return `agenda-slot:${dayStartMs}:${slotIndex}`;
}

export function agendaTaskStripDropId(dayStartMs: number) {
  return `agenda-taskstrip:${dayStartMs}`;
}

export function agendaMonthDayDropId(dayStartMs: number) {
  return `agenda-monthday:${dayStartMs}`;
}

/** Start timestamp for a 30-minute slot index (0–47) on a calendar day. */
export function agendaSlotStartMs(dayStartMs: number, slotIndex: number) {
  const startMin = slotIndex * 30;
  const hour = Math.floor(startMin / 60);
  const minute = startMin % 60;
  const d = new Date(dayStartMs);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

export function parseAgendaDrag(
  activeId: string,
): { kind: "event" | "task"; id: string } | null {
  if (activeId.startsWith("agenda-event:")) {
    return { kind: "event", id: activeId.slice("agenda-event:".length) };
  }
  if (activeId.startsWith("agenda-task:")) {
    return { kind: "task", id: activeId.slice("agenda-task:".length) };
  }
  return null;
}

export type AgendaDrop =
  | { kind: "slot"; dayStartMs: number; slotIndex: number }
  | { kind: "taskstrip"; dayStartMs: number }
  | { kind: "monthday"; dayStartMs: number };

export function parseAgendaDrop(overId: string): AgendaDrop | null {
  if (overId.startsWith("agenda-slot:")) {
    const m = /^agenda-slot:(-?\d+):(\d+)$/.exec(overId);
    if (!m) return null;
    return {
      kind: "slot",
      dayStartMs: Number(m[1]),
      slotIndex: Number(m[2]),
    };
  }
  if (overId.startsWith("agenda-taskstrip:")) {
    const m = /^agenda-taskstrip:(-?\d+)$/.exec(overId);
    if (!m) return null;
    return { kind: "taskstrip", dayStartMs: Number(m[1]) };
  }
  if (overId.startsWith("agenda-monthday:")) {
    const m = /^agenda-monthday:(-?\d+)$/.exec(overId);
    if (!m) return null;
    return { kind: "monthday", dayStartMs: Number(m[1]) };
  }
  return null;
}
