import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, Plus, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { KruvanLogo } from "@/components/brand/KruvanLogo";
import { NotificationMenu } from "@/components/layout/NotificationMenu";
import { useWorkspace } from "@/hooks/useWorkspace";

type Props = {
  onOpenQuickAdd: () => void;
};

export function Topbar({ onOpenQuickAdd }: Props) {
  const { workspaceName } = useWorkspace();
  const { signOut } = useAuthActions();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50/50 px-4 shadow-sm shadow-slate-200/20 backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <KruvanLogo size="sm" asHomeLink />
        <div className="min-w-0 border-l border-slate-200/80 pl-3">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-900">
            {workspaceName ?? "Workspace"}
          </p>
          <p className="truncate text-[11px] text-slate-500">Planning</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationMenu />
        <Link
          to="/settings"
          className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onOpenQuickAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-slate-900/15 transition hover:from-slate-700 hover:to-slate-800 active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Create</span>
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
