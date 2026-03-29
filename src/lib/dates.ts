export type DateDisplayOptions = {
  timeZone?: string;
  hour12?: boolean;
};

export function formatShortDate(ts: number | undefined, opts?: DateDisplayOptions) {
  if (ts === undefined) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(opts?.timeZone ? { timeZone: opts.timeZone } : {}),
  }).format(new Date(ts));
}

export function formatTime(ts: number, opts?: DateDisplayOptions) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(opts?.timeZone ? { timeZone: opts.timeZone } : {}),
    ...(opts?.hour12 !== undefined ? { hour12: opts.hour12 } : {}),
  }).format(new Date(ts));
}

/** First instant of the calendar week containing `anchor` (local wall-clock day start). */
export function weekStartAnchor(
  anchor: Date,
  weekStartsOn: "sunday" | "monday",
): Date {
  const d = startOfDay(anchor);
  const day = d.getDay();
  const diff =
    weekStartsOn === "monday" ? (day + 6) % 7 : day;
  d.setDate(d.getDate() - diff);
  return d;
}

/** Hour label for agenda grid (0–23). */
export function formatHourLabel(hour: number, hour12: boolean): string {
  if (!hour12) {
    return `${String(hour).padStart(2, "0")}:00`;
  }
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour < 12 ? "AM" : "PM";
  return `${h} ${period}`;
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** For `<input type="datetime-local" />` in local time (includes :00 seconds for broader browser support). */
export function timestampToDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Parses `datetime-local` value; returns NaN if invalid (do not treat as “now”). */
export function datetimeLocalToTimestamp(value: string): number {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? Number.NaN : t;
}

export function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfMonth(d: Date): number {
  return new Date(
    d.getFullYear(),
    d.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  ).getTime();
}

export function weekRange(
  anchor: Date,
  weekStartsOn: "sunday" | "monday" = "monday",
) {
  const start = weekStartAnchor(anchor, weekStartsOn);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

/** `yyyy-mm-dd` for `<input type="date" />`, or empty string. */
export function timestampToDateInputValue(ts: number | undefined): string {
  if (ts === undefined) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local noon on selected day → stable timestamp for due dates. */
export function dateInputValueToTimestamp(value: string): number | undefined {
  const v = value.trim();
  if (!v) return undefined;
  const d = new Date(`${v}T12:00:00`);
  const t = d.getTime();
  return Number.isNaN(t) ? undefined : t;
}
