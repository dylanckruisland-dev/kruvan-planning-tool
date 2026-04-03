import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { formatShortDate, formatTime } from "@/lib/dates";
import { CONTENT_PLATFORM_LABEL } from "@/lib/content-plan";
import { cn } from "@/lib/cn";
import type { Doc } from "@cvx/_generated/dataModel";
import { MentionInlineText } from "@/components/mentions/MentionInlineText";
import { PlanAttachmentHint } from "@/components/content/PlanAttachmentHint";

type Props = {
  plan: Doc<"contentPlans">;
  imageUrl: string | undefined;
  onOpen: () => void;
  /** When false, hide drag handle (e.g. project tab). Default true. */
  draggable?: boolean;
};

export function ContentPlanBoardCard({
  plan,
  imageUrl,
  onOpen,
  draggable = true,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: String(plan._id),
      disabled: !draggable,
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100/80 transition",
        isDragging &&
          "z-10 cursor-grabbing opacity-90 shadow-lg ring-2 ring-accent-dnd",
        !isDragging && "hover:border-slate-300",
      )}
    >
      <div className="flex gap-2">
        {draggable ? (
          <button
            type="button"
            className="mt-0.5 shrink-0 cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
            aria-label="Drag to change status"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <span className="mt-0.5 w-1 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 rounded-lg text-left transition hover:bg-slate-50/80"
        >
          <p className="text-sm font-medium text-slate-900">
            <MentionInlineText text={plan.title} />
          </p>
          {plan.contentFormat ? (
            <p className="mt-0.5 text-[10px] font-medium text-slate-600">
              {plan.contentFormat}
            </p>
          ) : null}
          {plan.notes ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
              <MentionInlineText text={plan.notes} />
            </p>
          ) : null}
          <PlanAttachmentHint plan={plan} imageUrl={imageUrl} />
          <div className="mt-2 flex flex-wrap gap-1">
            {plan.platforms
              .filter((p) => p !== "other")
              .map((p) => (
                <span
                  key={p}
                  className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                >
                  {CONTENT_PLATFORM_LABEL[p]}
                </span>
              ))}
            {plan.customPlatforms?.map((c) => (
              <span
                key={`c-${c}`}
                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
              >
                {c}
              </span>
            ))}
          </div>
          {plan.scheduledFor != null ? (
            <p className="mt-2 text-[10px] text-slate-500">
              Scheduled {formatShortDate(plan.scheduledFor)} ·{" "}
              {formatTime(plan.scheduledFor)}
            </p>
          ) : null}
        </button>
      </div>
    </div>
  );
}
