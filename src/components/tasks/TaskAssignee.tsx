import { cn } from "@/lib/cn";
import { initialsFromDisplayName } from "@/lib/display-name";

type Props = {
  name: string;
  className?: string;
  /** Hide the text label (initials only). */
  compact?: boolean;
};

export function TaskAssignee({ name, className, compact }: Props) {
  const initials = initialsFromDisplayName(name);
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full bg-slate-100/90 py-0.5 pl-0.5 pr-2 ring-1 ring-slate-200/80",
        compact && "pr-1",
        className,
      )}
      title={name}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[10px] font-bold tabular-nums text-slate-800 shadow-sm"
        aria-hidden
      >
        {initials}
      </span>
      {!compact ? (
        <span className="min-w-0 truncate text-xs font-medium text-slate-700">
          {name}
        </span>
      ) : null}
    </span>
  );
}
