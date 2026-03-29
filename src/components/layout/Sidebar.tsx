import {
  CalendarDays,
  ChevronRight,
  FolderOpen,
  Inbox,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  StickyNote,
  CheckSquare,
  Clapperboard,
} from "lucide-react";
import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { FolderModal } from "@/components/folders/FolderModal";
import { FolderTree } from "@/components/layout/FolderTree";
import { useToast } from "@/contexts/ToastContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/cn";
import { searchParamsForPath } from "@/lib/route-search";
import type { Doc, Id } from "@cvx/_generated/dataModel";

type FolderModalState =
  | { mode: "create"; parentId?: Id<"folders"> }
  | { mode: "edit"; folder: Doc<"folders"> };

const TOP_NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/projects", label: "Projects", icon: FolderOpen },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/content", label: "Content", icon: Clapperboard },
] as const;

function workspaceInitials(name: string) {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenCommand: () => void;
};

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onOpenCommand,
}: SidebarProps) {
  const { toast } = useToast();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { workspaceId, setWorkspaceId } = useWorkspace();
  const workspaces = useQuery(api.workspaces.list);
  const folders = useQuery(
    api.folders.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const sidebarProjects = useQuery(
    api.projects.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const removeFolder = useMutation(api.folders.remove);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [folderModal, setFolderModal] = useState<FolderModalState | null>(
    null,
  );
  const [deleteFolder, setDeleteFolder] = useState<Doc<"folders"> | null>(
    null,
  );
  const [deleteBusy, setDeleteBusy] = useState(false);

  const currentWorkspaceName =
    (workspaces ?? []).find((w) => w._id === workspaceId)?.name ?? "";

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200/70 bg-gradient-to-b from-white via-white to-slate-50/90 shadow-[inset_-1px_0_0_0_rgba(148,163,184,0.06)] transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        collapsed ? "w-[60px]" : "w-[264px]",
      )}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 border-b border-slate-200/60 px-2 pb-3 pt-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100/90 hover:text-slate-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <div className="h-px w-7 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          <label className="sr-only">Workspace</label>
          <div className="relative h-10 w-10 shrink-0">
            <div
              aria-hidden
              className="pointer-events-none flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gradient text-[11px] font-bold uppercase tracking-wide text-white shadow-md shadow-accent-glow ring-1 ring-white/25"
            >
              {workspaceInitials(currentWorkspaceName)}
            </div>
            <select
              className="absolute inset-0 cursor-pointer rounded-xl opacity-0"
              value={workspaceId ?? ""}
              onChange={(e) =>
                setWorkspaceId(e.target.value as Id<"workspaces">)
              }
              disabled={!workspaces?.length}
              title={currentWorkspaceName || "Choose workspace"}
              aria-label="Choose workspace"
            >
              {(workspaces ?? []).map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 border-b border-slate-200/60 px-3 py-3">
          <div className="min-w-0 flex-1">
            <label className="sr-only">Workspace</label>
            <select
              className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none ring-0 transition hover:border-slate-300/90 hover:shadow input-focus-accent"
              value={workspaceId ?? ""}
              onChange={(e) =>
                setWorkspaceId(e.target.value as Id<"workspaces">)
              }
              disabled={!workspaces?.length}
            >
              {(workspaces ?? []).map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100/90 hover:text-slate-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </div>
      )}
      <div className={cn("py-2.5", collapsed ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={onOpenCommand}
          className={cn(
            "group flex w-full cursor-pointer items-center text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus",
            collapsed
              ? "h-10 justify-center rounded-full bg-slate-100/80 hover:bg-slate-200/70 hover:text-slate-700 active:scale-[0.97]"
              : "gap-2.5 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2.5 text-left shadow-sm hover:border-slate-300/80 hover:bg-white hover:shadow-md active:scale-[0.99]",
          )}
          aria-label="Search workspace"
          title="Search workspace (⌘K)"
        >
          <Search
            className={cn(
              "h-4 w-4 shrink-0 transition group-hover:text-slate-600",
              collapsed ? "text-slate-500" : "text-slate-400",
            )}
            aria-hidden
          />
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-500">
                Search workspace…
              </span>
              <kbd className="hidden shrink-0 rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 sm:inline">
                ⌘K
              </kbd>
            </>
          ) : null}
        </button>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 pb-2">
        <div className={cn("flex flex-col", collapsed ? "items-center gap-1" : "gap-0.5")}>
          {TOP_NAV.map(({ to, label, icon: Icon }) => {
            const active =
              to === "/"
                ? pathname === "/"
                : pathname === to || pathname.startsWith(`${to}/`);
            const search = searchParamsForPath(to);
            return (
              <Link
                key={to}
                to={to}
                preload="intent"
                {...(search !== undefined ? { search } : {})}
                title={label}
                className={cn(
                  "group flex items-center text-[13px] font-medium transition",
                  collapsed
                    ? "h-10 w-10 justify-center rounded-full active:scale-[0.96]"
                    : "gap-2.5 rounded-xl px-3 py-2 active:scale-[0.99]",
                  active
                    ? collapsed
                      ? "bg-accent-soft-bold text-accent shadow-sm ring-2 ring-accent-outline"
                      : "bg-accent-soft text-accent-ink shadow-sm ring-1 ring-accent-soft-ring"
                    : collapsed
                      ? "text-slate-500 hover:bg-slate-100/90 hover:text-slate-800"
                      : "text-slate-600 hover:bg-slate-50/90 hover:text-slate-900",
                )}
              >
                <Icon
                  className={cn(
                    "shrink-0 transition-transform duration-150",
                    collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
                    active
                      ? "text-accent"
                      : "text-slate-400 group-hover:text-slate-600",
                    !collapsed && "group-hover:scale-105",
                  )}
                />
                {!collapsed ? label : null}
              </Link>
            );
          })}
        </div>

        {!collapsed ? (
          <div className="my-3 h-px bg-gradient-to-r from-transparent via-slate-200/90 to-transparent" />
        ) : (
          <div className="my-2 h-px w-7 self-center bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        )}

        <div className="min-h-0 flex-1">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5 pt-0.5">
              <Link
                to="/projects"
                preload="intent"
                search={{ project: undefined, folder: undefined }}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full transition active:scale-[0.96]",
                  pathname === "/projects" || pathname.startsWith("/projects/")
                    ? "bg-accent-soft-bold text-accent shadow-sm ring-2 ring-accent-outline"
                    : "text-slate-500 hover:bg-slate-100/90 hover:text-slate-800",
                )}
                title="Folders & projects"
                aria-label="Folders & projects"
              >
                <Inbox className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </Link>
              {workspaceId ? (
                <button
                  type="button"
                  onClick={() => setFolderModal({ mode: "create" })}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100/90 hover:text-accent active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus"
                  title="New folder"
                  aria-label="New folder"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-0.5 px-0.5">
                <button
                  type="button"
                  onClick={() => setFoldersOpen((o) => !o)}
                  className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 transition hover:bg-slate-50/80 hover:text-slate-500"
                >
                  <span className="flex items-center gap-1.5">
                    <Inbox className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    Folders
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-slate-400 transition duration-200",
                      foldersOpen && "rotate-90",
                    )}
                  />
                </button>
                {workspaceId ? (
                  <button
                    type="button"
                    onClick={() => setFolderModal({ mode: "create" })}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-accent-soft hover:text-accent"
                    title="New folder"
                    aria-label="New folder"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                  </button>
                ) : null}
              </div>
              {foldersOpen ? (
                <div className="mt-1 space-y-0.5 border-l border-slate-100 pl-1">
                  <FolderTree
                    folders={folders}
                    projects={sidebarProjects}
                    onEditFolder={(f) =>
                      setFolderModal({ mode: "edit", folder: f })
                    }
                    onDeleteFolder={(f) => setDeleteFolder(f)}
                    onCreateSubfolder={(parent) =>
                      setFolderModal({ mode: "create", parentId: parent._id })
                    }
                    onAddFolder={() => setFolderModal({ mode: "create" })}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </nav>

      {folderModal && workspaceId ? (
        <FolderModal
          open
          onClose={() => setFolderModal(null)}
          workspaceId={workspaceId}
          folders={folders ?? []}
          mode={folderModal.mode}
          folder={
            folderModal.mode === "edit" ? folderModal.folder : undefined
          }
          defaultParentId={
            folderModal.mode === "create"
              ? folderModal.parentId
              : undefined
          }
        />
      ) : null}

      <ConfirmDialog
        open={deleteFolder !== null}
        onClose={() => setDeleteFolder(null)}
        title="Delete folder?"
        description={
          deleteFolder
            ? `“${deleteFolder.name}” and any subfolders will be removed. Projects and notes in these folders will be unlinked (not deleted).`
            : ""
        }
        confirmLabel="Delete folder"
        variant="danger"
        busy={deleteBusy}
        onConfirm={async () => {
          if (!deleteFolder) return;
          setDeleteBusy(true);
          try {
            await removeFolder({ folderId: deleteFolder._id });
            toast("Folder deleted");
            setDeleteFolder(null);
          } finally {
            setDeleteBusy(false);
          }
        }}
      />

      <div
        className={cn(
          "border-t border-slate-200/60 bg-white/40 p-2 backdrop-blur-[2px]",
          collapsed && "flex justify-center px-2",
        )}
      >
        <Link
          to="/settings"
          preload="intent"
          title="Settings"
          className={cn(
            "group flex items-center text-[13px] font-medium transition",
            collapsed
              ? "mx-auto h-10 w-10 justify-center rounded-full active:scale-[0.96]"
              : "gap-2.5 rounded-xl px-3 py-2 active:scale-[0.99]",
            pathname === "/settings"
              ? collapsed
                ? "bg-accent-soft-bold text-accent shadow-sm ring-2 ring-accent-outline"
                : "bg-accent-soft text-accent-ink shadow-sm ring-1 ring-accent-soft-ring"
              : collapsed
                ? "text-slate-500 hover:bg-slate-100/90 hover:text-slate-800"
                : "text-slate-600 hover:bg-slate-50/90 hover:text-slate-900",
          )}
        >
          <Settings
            className={cn(
              "shrink-0 transition-transform duration-150",
              collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
              pathname === "/settings"
                ? "text-accent"
                : "text-slate-400 group-hover:text-slate-600",
              !collapsed && "group-hover:scale-105",
            )}
          />
          {!collapsed ? "Settings" : null}
        </Link>
      </div>
    </aside>
  );
}
