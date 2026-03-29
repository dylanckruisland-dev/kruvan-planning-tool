import { cn } from "@/lib/cn";

const styles: Record<string, string> = {
  planning: "bg-slate-100 text-slate-700 ring-slate-200/80",
  active: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  on_hold: "bg-amber-50 text-amber-800 ring-amber-100",
  done: "bg-slate-100 text-slate-600 ring-slate-200/80",
  todo: "bg-slate-50 text-slate-700 ring-slate-200/80",
  in_progress:
    "bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent-soft-ring",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-100",
};

const labels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  done: "Done",
  todo: "To do",
  in_progress: "In progress",
  cancelled: "Cancelled",
};

type Props = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[status] ?? "bg-slate-50 text-slate-700 ring-slate-200/80",
        className,
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
