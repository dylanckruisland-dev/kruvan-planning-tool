import { ChevronDown, ChevronUp } from "lucide-react";
import type { TaskDueSortDir } from "@/lib/task-due-sort";
import { cn } from "@/lib/cn";

type Props = {
  value: TaskDueSortDir | undefined;
  onChange: (value: TaskDueSortDir | undefined) => void;
  className?: string;
  /** Visually smaller for dense toolbars */
  compact?: boolean;
};

/** Cycles: manual order → ascending → descending → manual order. */
export function TaskDueSortToggle({
  value,
  onChange,
  className,
  compact,
}: Props) {
  function cycle() {
    if (value === undefined) onChange("asc");
    else if (value === "asc") onChange("desc");
    else onChange(undefined);
  }

  const active = value !== undefined;
  const asc = value === "asc";

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50",
        compact && "py-1.5",
        className,
      )}
      aria-pressed={active}
      aria-label={
        !active
          ? "Sort by due date: ascending"
          : asc
            ? "Due date: ascending (click for descending, or again for manual order)"
            : "Due date: descending (click for manual order)"
      }
    >
      <span className="text-slate-600">Due date</span>
      {active ? (
        asc ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
        ) : (
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-accent"
            aria-hidden
          />
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
