import { useCallback, useEffect, useState } from "react";
import { Outlet, useRouter } from "@tanstack/react-router";
import { PageTransition } from "@/components/layout/PageTransition";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/modals/CommandPalette";
import { QuickAddModal } from "@/components/modals/QuickAddModal";
import { ShellActionsProvider } from "@/contexts/ShellActionsProvider";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { ToastProvider } from "@/contexts/ToastContext";
import { OpenTabsBar } from "@/components/layout/OpenTabsBar";
import { TrackRecentRoute } from "@/components/layout/TrackRecentRoute";
import { WorkspaceInviteBanner } from "@/components/layout/WorkspaceInviteBanner";
import { OpenTabsProvider } from "@/contexts/OpenTabsContext";

const SIDEBAR_COLLAPSED_KEY = "kruvan-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell() {
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddStartVoice, setQuickAddStartVoice] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    if (e.key === "Escape" && mobileNavOpen) {
      setMobileNavOpen(false);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setCommandOpen((o) => !o);
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      setQuickAddStartVoice(false);
      setQuickAddOpen(true);
    }
  }, [mobileNavOpen]);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  useEffect(() => {
    return router.subscribe("onResolved", () => {
      setMobileNavOpen(false);
    });
  }, [router]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

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
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileNavOpen={mobileNavOpen}
        onCloseMobileNav={() => setMobileNavOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        onOpenCommand={() => setCommandOpen(true)}
      />
      <OpenTabsProvider>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar
            onOpenQuickAdd={() => {
              setQuickAddStartVoice(false);
              setQuickAddOpen(true);
            }}
            onOpenVoiceCommand={() => {
              setQuickAddStartVoice(true);
              setQuickAddOpen(true);
            }}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          <div className="relative z-10 mx-auto w-full max-w-6xl shrink-0 px-4 sm:px-6 lg:px-8">
            <OpenTabsBar />
          </div>
          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-outline"
          >
            <div className="mx-auto max-w-6xl px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8">
              <WorkspaceInviteBanner />
              <ShellActionsProvider
                openQuickAdd={(opts) => {
                  setQuickAddStartVoice(Boolean(opts?.voice));
                  setQuickAddOpen(true);
                }}
              >
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
      </OpenTabsProvider>
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onQuickAdd={() => {
          setCommandOpen(false);
          setQuickAddStartVoice(false);
          setQuickAddOpen(true);
        }}
      />
      <QuickAddModal
        open={quickAddOpen}
        startVoiceOnOpen={quickAddStartVoice}
        onClose={() => {
          setQuickAddOpen(false);
          setQuickAddStartVoice(false);
        }}
      />
        </div>
      </div>
    </ToastProvider>
  );
}
