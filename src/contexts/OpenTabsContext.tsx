/* eslint-disable react-refresh/only-export-components -- provider + hooks */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import type { OpenTab } from "@/lib/open-tabs";
import {
  defaultTitleForLocation,
  inferTabType,
  tabKeyFromLocation,
} from "@/lib/open-tabs";

type OpenTabsContextValue = {
  tabs: OpenTab[];
  activeKey: string;
  closeTab: (key: string) => void;
  updateTabTitle: (key: string, title: string) => void;
  activateTab: (tab: OpenTab) => void;
};

const OpenTabsContext = createContext<OpenTabsContextValue | null>(null);

export function OpenTabsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const location = useRouterState({ select: (s) => s.location });
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [visitStack, setVisitStack] = useState<string[]>([]);

  const tabsRef = useRef(tabs);
  const visitStackRef = useRef(visitStack);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  useEffect(() => {
    visitStackRef.current = visitStack;
  }, [visitStack]);

  const activeKey = useMemo(
    () => tabKeyFromLocation(location),
    [location],
  );

  useEffect(() => {
    const loc = router.state.location;
    const key = tabKeyFromLocation(loc);
    const href = loc.href;
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], href };
        return next;
      }
      return [
        ...prev,
        {
          key,
          type: inferTabType(key, loc.pathname),
          title: defaultTitleForLocation(loc),
          href,
        },
      ];
    });
    setVisitStack((prev) => [...prev.filter((k) => k !== key), key]);
  }, [location.href, router]);

  const updateTabTitle = useCallback((key: string, title: string) => {
    const t = title.trim();
    if (!t) return;
    setTabs((prev) =>
      prev.map((tab) => (tab.key === key ? { ...tab, title: t } : tab)),
    );
  }, []);

  const activateTab = useCallback(
    (tab: OpenTab) => {
      void router.navigate({ href: tab.href });
    },
    [router],
  );

  const closeTab = useCallback(
    (key: string) => {
      const currentKey = tabKeyFromLocation(router.state.location);
      const stackBefore = visitStackRef.current.filter((k) => k !== key);
      const nextTabs = tabsRef.current.filter((t) => t.key !== key);

      setTabs(nextTabs);
      setVisitStack(stackBefore);

      if (currentKey !== key) return;

      const targetKey = stackBefore[stackBefore.length - 1];
      const targetTab = nextTabs.find((t) => t.key === targetKey);

      queueMicrotask(() => {
        if (targetTab) {
          void router.navigate({ href: targetTab.href });
        } else {
          void router.navigate({ to: "/" });
        }
      });
    },
    [router],
  );

  const value = useMemo(
    () => ({
      tabs,
      activeKey,
      closeTab,
      updateTabTitle,
      activateTab,
    }),
    [tabs, activeKey, closeTab, updateTabTitle, activateTab],
  );

  return (
    <OpenTabsContext.Provider value={value}>
      {children}
    </OpenTabsContext.Provider>
  );
}

export function useOpenTabs(): OpenTabsContextValue {
  const ctx = useContext(OpenTabsContext);
  if (!ctx) {
    throw new Error("useOpenTabs must be used within OpenTabsProvider");
  }
  return ctx;
}
