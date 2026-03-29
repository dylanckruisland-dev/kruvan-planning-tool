import { cn } from "@/lib/cn";

const styles: Record<string, string> = {
  low: "bg-slate-50 text-slate-600 ring-slate-200/80",
  medium: "bg-sky-50 text-sky-800 ring-sky-100",
  high: "bg-orange-50 text-orange-800 ring-orange-100",
  urgent: "bg-red-50 text-red-800 ring-red-100",
};

const labels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

type Props = {
  priority: string;
  className?: string;
};

export function PriorityBadge({ priority, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[priority] ?? "bg-slate-50 text-slate-600 ring-slate-200/80",
        className,
      )}
    >
      {labels[priority] ?? priority}
    </span>
  );
}
