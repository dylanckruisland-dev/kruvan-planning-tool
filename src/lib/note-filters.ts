import { addDays, startOfDay } from "@/lib/dates";
import type { Doc } from "@cvx/_generated/dataModel";

export type NoteDatePreset = "all" | "today" | "last7" | "last30";

/** Creation time for display and filtering (legacy notes without `createdAt` use `updatedAt`). */
export function noteCreatedAtMs(note: Doc<"notes">): number {
  return note.createdAt ?? note.updatedAt;
}

/** Range on note creation time (ms) for project note filtering. */
export function noteCreatedRange(preset: NoteDatePreset): {
  createdFrom?: number;
  createdTo?: number;
} {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const endTs = end.getTime();

  if (preset === "all") return {};

  if (preset === "today") {
    return { createdFrom: startOfDay(now).getTime(), createdTo: endTs };
  }

  if (preset === "last7") {
    return {
      createdFrom: startOfDay(addDays(now, -6)).getTime(),
      createdTo: endTs,
    };
  }

  if (preset === "last30") {
    return {
      createdFrom: startOfDay(addDays(now, -29)).getTime(),
      createdTo: endTs,
    };
  }

  return {};
}
