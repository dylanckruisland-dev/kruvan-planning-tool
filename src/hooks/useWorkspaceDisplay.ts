import { useCallback, useMemo } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  formatShortDate,
  formatTime,
  type DateDisplayOptions,
} from "@/lib/dates";

/** Time/date formatting + week start from active workspace preferences. */
export function useWorkspaceDisplay() {
  const { workspace } = useWorkspace();

  const opts = useMemo((): DateDisplayOptions => {
    const timeZone = workspace?.timezone?.trim() || undefined;
    const hour12 =
      workspace?.timeFormat === "12"
        ? true
        : workspace?.timeFormat === "24"
          ? false
          : undefined;
    return { timeZone, hour12 };
  }, [workspace?.timezone, workspace?.timeFormat]);

  const formatTimeWs = useCallback(
    (ts: number) => formatTime(ts, opts),
    [opts],
  );

  const formatShortDateWs = useCallback(
    (ts: number | undefined) => formatShortDate(ts, opts),
    [opts],
  );

  const weekStartsOn = workspace?.weekStartsOn ?? "monday";
  const hour12Grid =
    workspace?.timeFormat === "12"
      ? true
      : workspace?.timeFormat === "24"
        ? false
        : false;

  return {
    formatTime: formatTimeWs,
    formatShortDate: formatShortDateWs,
    dateOpts: opts,
    weekStartsOn,
    /** Prefer 24h grid unless user chose 12h display. */
    hour12Grid,
  };
}
