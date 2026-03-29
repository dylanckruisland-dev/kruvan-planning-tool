import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Doc, Id } from "@cvx/_generated/dataModel";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: Id<"workspaces">;
  folders: Doc<"folders">[];
  mode: "create" | "edit";
  folder?: Doc<"folders">;
  /** When creating, pre-select this parent (e.g. “New subfolder” from the ⋮ menu). */
  defaultParentId?: Id<"folders">;
};

function collectDescendantIds(
  root: Id<"folders">,
  all: Doc<"folders">[],
): Set<string> {
  const out = new Set<string>();
  function walk(id: Id<"folders">) {
    out.add(String(id));
    for (const f of all) {
      if (f.parentId === id) walk(f._id);
    }
  }
  walk(root);
  return out;
}

function parentSelectOptions(
  folders: Doc<"folders">[],
  excludeIds: Set<string>,
): { id: string; label: string }[] {
  const allowed = folders.filter((f) => !excludeIds.has(String(f._id)));
  const byParent = new Map<string, Doc<"folders">[]>();
  for (const r of allowed) {
    const k =
      r.parentId && allowed.some((x) => x._id === r.parentId)
        ? String(r.parentId)
        : "__root__";
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(r);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const out: { id: string; label: string }[] = [
    { id: "", label: "Top level" },
  ];
  function walk(parentKey: string | undefined, depth: number) {
    const key = parentKey === undefined ? "__root__" : parentKey;
    const kids = byParent.get(key) ?? [];
    for (const c of kids) {
      const id = String(c._id);
      out.push({
        id,
        label: `${"\u2014 ".repeat(depth)}${c.name}`,
      });
      walk(id, depth + 1);
    }
  }
  walk(undefined, 0);
  return out;
}

export function FolderModal({
  open,
  onClose,
  workspaceId,
  folders,
  mode,
  folder,
  defaultParentId,
}: Props) {
  const createFolder = useMutation(api.folders.create);
  const updateFolder = useMutation(api.folders.update);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);

  const excludeIds = useMemo(() => {
    if (mode !== "edit" || !folder) return new Set<string>();
    return collectDescendantIds(folder._id, folders);
  }, [mode, folder, folders]);

  const parentOptions = useMemo(
    () => parentSelectOptions(folders, excludeIds),
    [folders, excludeIds],
  );

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setName("");
      setParentId(defaultParentId ? String(defaultParentId) : "");
    } else if (folder) {
      setName(folder.name);
      setParentId(folder.parentId ? String(folder.parentId) : "");
    }
  }, [open, mode, folder, defaultParentId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      if (mode === "create") {
        await createFolder({
          workspaceId,
          name: n,
          parentId: parentId ? (parentId as Id<"folders">) : undefined,
        });
      } else if (folder) {
        await updateFolder({
          folderId: folder._id,
          name: n,
          parentId: parentId ? (parentId as Id<"folders">) : null,
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/25 p-4 pt-[15vh] backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-modal-title"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="folder-modal-title"
            className="text-sm font-semibold text-slate-900"
          >
            {mode === "create"
              ? defaultParentId
                ? "New subfolder"
                : "New folder"
              : "Rename folder"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Folders organize projects and notes. You can nest folders under each
          other.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="folder-name"
              className="text-xs font-medium text-slate-600"
            >
              Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Work, Clients"
              required
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="folder-parent"
              className="text-xs font-medium text-slate-600"
            >
              Inside folder
            </label>
            <select
              id="folder-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={inputClass}
            >
              {parentOptions.map((o) => (
                <option key={o.id || "root"} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
            >
              {mode === "create"
                ? defaultParentId
                  ? "Create subfolder"
                  : "Create folder"
                : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
