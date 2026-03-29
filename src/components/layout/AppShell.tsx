import { useCallback, useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { PageTransition } from "@/components/layout/PageTransition";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/modals/CommandPalette";
import { QuickAddModal } from "@/components/modals/QuickAddModal";
import { ShellActionsProvider } from "@/contexts/ShellActionsContext";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { ToastProvider } from "@/contexts/ToastContext";
import { TrackRecentRoute } from "@/components/layout/TrackRecentRoute";

const SIDEBAR_COLLAPSED_KEY = "kruvan-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(
        SIDEBAR_COLLAPSED_KEY,
        sidebarCollapsed ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setCommandOpen((o) => !o);
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      setQuickAddOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <ToastProvider>
      <div className="h-full min-h-0 w-full">
        <TrackRecentRoute />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:ring-2 focus:ring-accent-outline"
        >
          Skip to main content
        </a>
        <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#f6f7f9]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        onOpenCommand={() => setCommandOpen(true)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar onOpenQuickAdd={() => setQuickAddOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-outline"
        >
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <ShellActionsProvider openQuickAdd={() => setQuickAddOpen(true)}>
              <RouteErrorBoundary>
                <PageTransition>
                  <Outlet />
                </PageTransition>
              </RouteErrorBoundary>
            </ShellActionsProvider>
          </div>
          <div id="app-status" aria-live="polite" className="sr-only" />
        </main>
      </div>
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onQuickAdd={() => {
          setCommandOpen(false);
          setQuickAddOpen(true);
        }}
      />
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
        </div>
      </div>
    </ToastProvider>
  );
}
