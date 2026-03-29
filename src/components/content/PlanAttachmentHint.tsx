import { isImageContentType, isVideoContentType } from "@/lib/content-plan";
import type { Doc } from "@cvx/_generated/dataModel";
import { Film, Paperclip } from "lucide-react";

export function PlanAttachmentHint({
  plan,
  imageUrl,
}: {
  plan: Doc<"contentPlans">;
  imageUrl: string | undefined;
}) {
  const attachments = plan.attachments ?? [];
  const n = attachments.length;
  if (n === 0) return null;

  const hasVideo = attachments.some((a) =>
    isVideoContentType(a.contentType),
  );
  const hasImage = attachments.some((a) =>
    isImageContentType(a.contentType),
  );

  return (
    <div className="mt-2 flex items-center gap-2">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200/80"
        />
      ) : hasVideo && !hasImage ? (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 ring-1 ring-slate-200/80"
          aria-hidden
        >
          <Film className="h-4 w-4 text-slate-500" />
        </div>
      ) : null}
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
        <Paperclip className="h-3 w-3" aria-hidden />
        {n}
      </span>
    </div>
  );
}
