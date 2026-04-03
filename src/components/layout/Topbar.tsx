import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, Menu, Mic, Plus, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { KruvanLogo } from "@/components/brand/KruvanLogo";
import { NotificationMenu } from "@/components/layout/NotificationMenu";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/cn";

type Props = {
  onOpenQuickAdd: () => void;
  onOpenVoiceCommand: () => void;
  onOpenMobileNav: () => void;
};

export function Topbar({
  onOpenQuickAdd,
  onOpenVoiceCommand,
  onOpenMobileNav,
}: Props) {
  const { workspaceName, workspaceId } = useWorkspace();
  const { signOut } = useAuthActions();

  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50/50 px-3 shadow-sm shadow-slate-200/20 backdrop-blur-md sm:gap-4 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus lg:hidden touch-manipulation"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>
        <KruvanLogo size="sm" asHomeLink />
        <div className="min-w-0 border-l border-slate-200/80 pl-3">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-900">
            {workspaceName ?? "Workspace"}
          </p>
          <p className="truncate text-[11px] text-slate-500">Planning</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={onOpenVoiceCommand}
          disabled={!workspaceId}
          className={cn(
            "relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800",
            !workspaceId && "pointer-events-none opacity-50",
          )}
          aria-label="Voice command"
          title="Voice command"
        >
          <Mic className="h-4 w-4" />
        </button>
        <NotificationMenu />
        <Link
          to="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:h-9 sm:w-9 sm:p-2 max-lg:min-h-[44px] max-lg:min-w-[44px] touch-manipulation"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onOpenQuickAdd}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 px-2.5 py-2 text-xs font-semibold text-white shadow-md shadow-slate-900/15 transition hover:from-slate-700 hover:to-slate-800 active:scale-[0.98] sm:min-h-0 sm:px-3 max-lg:min-h-[44px] touch-manipulation"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Create</span>
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:h-9 sm:w-9 sm:p-2 max-lg:min-h-[44px] max-lg:min-w-[44px] touch-manipulation"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
