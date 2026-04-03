import { FileText, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/dates";
import { MentionInlineText } from "@/components/mentions/MentionInlineText";
import { htmlToPlainText } from "@/lib/note-html";
import { noteCreatedAtMs } from "@/lib/note-filters";
import type { Doc } from "@cvx/_generated/dataModel";

type Note = Doc<"notes">;

type Props = {
  note: Note;
  projectName?: string;
  selected?: boolean;
  onClick?: () => void;
  /** Opens delete flow (e.g. confirm dialog). Clicks do not select the card. */
  onDelete?: () => void;
  className?: string;
};

export function NoteCard({
  note,
  projectName,
  selected,
  onClick,
  onDelete,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-2xl border shadow-sm transition",
        selected
          ? "border-accent-border bg-accent-soft ring-2 ring-accent-soft-ring"
          : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-outline"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex w-full items-start justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                <MentionInlineText text={note.title} />
              </p>
              <p className="shrink-0 text-right text-[11px] font-medium tabular-nums text-slate-500">
                {formatShortDate(noteCreatedAtMs(note))}
              </p>
            </div>
            {projectName ? (
              <p className="mt-0.5 text-[11px] font-medium text-accent">
                {projectName}
              </p>
            ) : null}
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">
              <MentionInlineText
                text={htmlToPlainText(note.body) || "—"}
              />
            </p>
          </div>
        </div>
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={cn(
            "flex shrink-0 items-center justify-center border-l px-2.5 py-2 transition",
            selected
              ? "border-accent-soft text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              : "border-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600",
          )}
          aria-label="Delete note"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
