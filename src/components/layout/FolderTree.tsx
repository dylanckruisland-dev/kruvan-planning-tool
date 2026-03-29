import { ChevronRight, File, MoreHorizontal } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { cn } from "@/lib/cn";

type Props = {
  folders: Doc<"folders">[] | undefined;
  /** All workspace projects; rows with `folderId` are shown under that folder in the tree. */
  projects: Doc<"projects">[] | undefined;
  onEditFolder: (folder: Doc<"folders">) => void;
  onDeleteFolder: (folder: Doc<"folders">) => void;
  onCreateSubfolder: (parent: Doc<"folders">) => void;
  onAddFolder?: () => void;
};

function buildTree(
  rows: Doc<"folders">[],
  projects: Doc<"projects">[],
  onEdit: (f: Doc<"folders">) => void,
  onDelete: (f: Doc<"folders">) => void,
  onCreateSubfolder: (parent: Doc<"folders">) => void,
  isFolderExpanded: (folderId: string) => boolean,
  toggleFolder: (folderId: string) => void,
) {
  const byParent = new Map<string, Doc<"folders">[]>();
  for (const r of rows) {
    const k = r.parentId ? String(r.parentId) : "__root__";
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(r);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const projectsByFolder = new Map<string, Doc<"projects">[]>();
  for (const p of projects) {
    if (!p.folderId) continue;
    const k = String(p.folderId);
    if (!projectsByFolder.has(k)) projectsByFolder.set(k, []);
    projectsByFolder.get(k)!.push(p);
  }
  for (const arr of projectsByFolder.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }

  function walk(
    parent: Id<"folders"> | undefined,
    depth: number,
    activeFolder: string | undefined,
    activeProjectId: string | undefined,
  ): ReactElement[] {
    const key = parent === undefined ? "__root__" : String(parent);
    const kids = byParent.get(key) ?? [];
    return kids.flatMap((c) => {
      const id = String(c._id);
      const active = activeFolder === id;
      const inFolder = projectsByFolder.get(id) ?? [];
      const subFolders = byParent.get(id) ?? [];
      const hasNested = subFolders.length > 0 || inFolder.length > 0;
      const expanded = isFolderExpanded(id);
      const projectIndent = 8 + (depth + 1) * 12;
      return [
        <div
          key={id}
          className="group flex min-w-0 items-center gap-0.5 rounded-lg pr-1"
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {hasNested ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFolder(id);
              }}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse folder" : "Expand folder"}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  expanded && "rotate-90",
                )}
                aria-hidden
              />
            </button>
          ) : (
            <span className="h-7 w-7 shrink-0" aria-hidden />
          )}
          <Link
            to="/projects"
            search={{ project: undefined, folder: id }}
            className={cn(
              "flex min-w-0 flex-1 items-center rounded-lg py-1.5 pr-2 text-left text-[13px] transition",
              active
                ? "font-semibold text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <span className="truncate">{c.name}</span>
          </Link>
          <div className="shrink-0">
            <FolderRowMenu
              folder={c}
              onEdit={onEdit}
              onDelete={onDelete}
              onCreateSubfolder={onCreateSubfolder}
            />
          </div>
        </div>,
        ...(expanded
          ? [
              ...inFolder.map((p) => {
                const pid = String(p._id);
                const projectActive = activeProjectId === pid;
                return (
                  <div key={`p-${pid}`} className="min-w-0 pr-1">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: String(p._id) }}
                      search={{ tab: "overview", taskView: "list" }}
                      className={cn(
                        "flex min-w-0 items-center gap-1.5 rounded-lg py-1 pr-2 text-left text-[12.5px] transition",
                        projectActive
                          ? "font-semibold text-slate-900"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                      style={{ paddingLeft: projectIndent }}
                    >
                      <File
                        className="h-3.5 w-3.5 shrink-0 text-slate-400"
                        aria-hidden
                      />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  </div>
                );
              }),
              ...walk(c._id, depth + 1, activeFolder, activeProjectId),
            ]
          : []),
      ];
    });
  }
  return walk;
}

function FolderRowMenu({
  folder,
  onEdit,
  onDelete,
  onCreateSubfolder,
}: {
  folder: Doc<"folders">;
  onEdit: (f: Doc<"folders">) => void;
  onDelete: (f: Doc<"folders">) => void;
  onCreateSubfolder: (parent: Doc<"folders">) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const el = e.target as HTMLElement;
      if (!el.closest("[data-folder-menu]")) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative" data-folder-menu>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Folder actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-30 mt-1 min-w-[10.5rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          data-folder-menu
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onCreateSubfolder(folder);
            }}
            className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
          >
            New subfolder…
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onEdit(folder);
            }}
            className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
          >
            Rename…
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete(folder);
            }}
            className="block w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50"
          >
            Delete…
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function FolderTree({
  folders,
  projects,
  onEditFolder,
  onDeleteFolder,
  onCreateSubfolder,
  onAddFolder,
}: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({
    select: (s) =>
      s.location.search as { folder?: string; project?: string },
  });
  const activeFolder =
    pathname === "/projects" ? search.folder : undefined;

  const activeProjectId = useMemo(() => {
    const m = pathname.match(/^\/projects\/([^/]+)$/);
    return m?.[1];
  }, [pathname]);

  /** `false` = collapsed; missing/`true` = expanded (default open). */
  const [folderOpen, setFolderOpen] = useState<Record<string, boolean>>({});

  const isFolderExpanded = useCallback(
    (folderId: string) => folderOpen[folderId] !== false,
    [folderOpen],
  );

  const toggleFolder = useCallback((folderId: string) => {
    setFolderOpen((prev) => ({
      ...prev,
      [folderId]: prev[folderId] !== false ? false : true,
    }));
  }, []);

  const nodes = useMemo(() => {
    if (!folders?.length) return null;
    return buildTree(
      folders,
      projects ?? [],
      onEditFolder,
      onDeleteFolder,
      onCreateSubfolder,
      isFolderExpanded,
      toggleFolder,
    )(undefined, 0, activeFolder, activeProjectId);
  }, [
    folders,
    projects,
    activeFolder,
    activeProjectId,
    onEditFolder,
    onDeleteFolder,
    onCreateSubfolder,
    isFolderExpanded,
    toggleFolder,
  ]);

  if (!folders) {
    return (
      <p className="px-2 py-2 text-[12px] text-slate-400">Loading…</p>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="space-y-2 px-2 py-1">
        <p className="text-[12px] text-slate-400">No folders yet</p>
        {onAddFolder ? (
          <button
            type="button"
            onClick={onAddFolder}
            className="text-xs font-semibold text-accent hover:text-accent-strong hover:underline"
          >
            Add folder
          </button>
        ) : null}
      </div>
    );
  }

  return <div className="space-y-0.5">{nodes}</div>;
}
