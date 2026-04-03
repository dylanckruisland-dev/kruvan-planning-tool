import { useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useOpenTabs } from "@/contexts/OpenTabsContext";
import { tabKeyFromLocation } from "@/lib/open-tabs";

/**
 * Updates the label of the open tab that matches the current route.
 * Call from page components once the resource title is known.
 */
export function useTabTitle(title: string) {
  const location = useRouterState({ select: (s) => s.location });
  const { updateTabTitle } = useOpenTabs();
  const key = useMemo(() => tabKeyFromLocation(location), [location]);

  useEffect(() => {
    const t = title.trim();
    if (!t) return;
    updateTabTitle(key, t);
  }, [key, title, updateTabTitle]);
}
