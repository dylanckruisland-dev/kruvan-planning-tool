import {
  closestCorners,
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { type ReactNode } from "react";
import { api } from "@cvx/_generated/api";
import { ContentPlanBoardCard } from "@/components/content/ContentPlanBoardCard";
import {
  CONTENT_STATUS_LABEL,
  CONTENT_STATUS_ORDER,
  type ContentStatus,
} from "@/lib/content-plan";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@cvx/_generated/dataModel";

type ContentPlan = Doc<"contentPlans">;

function columnId(status: ContentStatus) {
  return `col-${status}`;
}

function DroppableColumn({
  status,
  count,
  children,
  onAdd,
}: {
  status: ContentStatus;
  count: number;
  children: ReactNode;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });

  return (
    <section className="flex min-w-[200px] flex-1 flex-col rounded-2xl border border-slate-200/80 bg-slate-50/80 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 px-3 py-2.5">
        <span className="text-xs font-semibold text-slate-800">
          {CONTENT_STATUS_LABEL[status]}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/80">
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 p-2 transition-colors",
          isOver && "bg-accent-tint ring-1 ring-inset ring-accent-soft-ring",
        )}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="m-2 mt-0 rounded-lg border border-dashed border-slate-300 py-2 text-[11px] font-medium text-slate-500 transition hover:border-slate-400 hover:bg-white hover:text-slate-700"
      >
        + Add
      </button>
    </section>
  );
}

type Props = {
  items: ContentPlan[];
  grouped: Record<ContentStatus, ContentPlan[]>;
  imageUrlByPlanId: Map<string, string>;
  onOpenEdit: (plan: ContentPlan) => void;
  onAdd: (status: ContentStatus) => void;
};

export function ContentPlanBoard({
  items,
  grouped,
  imageUrlByPlanId,
  onOpenEdit,
  onAdd,
}: Props) {
  const updatePlan = useMutation(api.contentPlans.update);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const planIdStr = String(active.id);
    let targetStatus: ContentStatus | undefined;
    const overStr = String(over.id);
    if (overStr.startsWith("col-")) {
      targetStatus = overStr.slice(4) as ContentStatus;
    } else {
      const p = items.find((x) => String(x._id) === overStr);
      targetStatus = p?.status;
    }
    if (!targetStatus) return;
    const current = items.find((x) => String(x._id) === planIdStr);
    if (!current || current.status === targetStatus) return;
    await updatePlan({
      contentPlanId: current._id as Id<"contentPlans">,
      status: targetStatus,
    });
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      sensors={sensors}
      onDragEnd={(e) => void handleDragEnd(e)}
    >
      <div className="flex min-w-[920px] gap-3">
        {CONTENT_STATUS_ORDER.map((status) => {
          const list = grouped[status];
          return (
            <DroppableColumn
              key={status}
              status={status}
              count={list.length}
              onAdd={() => onAdd(status)}
            >
              {list.map((plan) => (
                <ContentPlanBoardCard
                  key={String(plan._id)}
                  plan={plan}
                  imageUrl={imageUrlByPlanId.get(String(plan._id))}
                  onOpen={() => onOpenEdit(plan)}
                />
              ))}
            </DroppableColumn>
          );
        })}
      </div>
    </DndContext>
  );
}
