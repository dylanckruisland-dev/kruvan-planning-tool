import { useMutation } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import type { ProjectFormValues } from "@/lib/project-form";
import { cn } from "@/lib/cn";

type TagRow = { _id: string; name: string };
type FolderRow = { _id: string; name: string };

type Props = {
  initial: ProjectFormValues;
  tags: TagRow[];
  folders: FolderRow[];
  /** Workspace id — when set, users can create new tags inline. */
  workspaceId?: Id<"workspaces">;
  onSubmit: (values: ProjectFormValues) => void | Promise<void>;
  submitLabel: string;
  busy?: boolean;
  showProgress?: boolean;
  idPrefix?: string;
  onCancel?: () => void;
  cancelLabel?: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

export function ProjectForm({
  initial,
  tags,
  folders,
  workspaceId,
  onSubmit,
  submitLabel,
  busy,
  showProgress = false,
  idPrefix = "pf",
  onCancel,
  cancelLabel = "Cancel",
}: Props) {
  const [values, setValues] = useState(initial);
  const [createdTags, setCreatedTags] = useState<TagRow[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [tagCreateBusy, setTagCreateBusy] = useState(false);
  const createTag = useMutation(api.tags.create);

  const allTags = useMemo(() => {
    const seen = new Set(tags.map((t) => t._id));
    const extra = createdTags.filter((t) => !seen.has(t._id));
    return [...tags, ...extra];
  }, [tags, createdTags]);

  useEffect(() => {
    setValues(initial);
  }, [initial]);

  function toggleTag(id: string) {
    setValues((v) => ({
      ...v,
      tagIds: v.tagIds.includes(id)
        ? v.tagIds.filter((x) => x !== id)
        : [...v.tagIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.name.trim()) return;
    await onSubmit({
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
    });
  }

  async function handleAddTag() {
    if (!workspaceId) return;
    const name = newTagName.trim();
    if (!name) return;
    setTagCreateBusy(true);
    try {
      const id = await createTag({ workspaceId, name });
      const row: TagRow = { _id: String(id), name };
      setCreatedTags((prev) => [...prev, row]);
      setValues((v) => ({
        ...v,
        tagIds: v.tagIds.includes(row._id) ? v.tagIds : [...v.tagIds, row._id],
      }));
      setNewTagName("");
    } finally {
      setTagCreateBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div>
        <label
          htmlFor={`${idPrefix}-name`}
          className="text-xs font-medium text-slate-600"
        >
          Name <span className="text-rose-600">*</span>
        </label>
        <input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          className={inputClass}
          placeholder="Project name"
          required
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-desc`}
          className="text-xs font-medium text-slate-600"
        >
          Description
        </label>
        <textarea
          id={`${idPrefix}-desc`}
          value={values.description}
          onChange={(e) =>
            setValues((v) => ({ ...v, description: e.target.value }))
          }
          rows={3}
          className={cn(inputClass, "resize-none")}
          placeholder="What is this project about?"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${idPrefix}-status`}
            className="text-xs font-medium text-slate-600"
          >
            Status
          </label>
          <select
            id={`${idPrefix}-status`}
            value={values.status}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                status: e.target.value as ProjectFormValues["status"],
              }))
            }
            className={inputClass}
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-priority`}
            className="text-xs font-medium text-slate-600"
          >
            Priority
          </label>
          <select
            id={`${idPrefix}-priority`}
            value={values.priority}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                priority: e.target.value as ProjectFormValues["priority"],
              }))
            }
            className={inputClass}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${idPrefix}-due`}
            className="text-xs font-medium text-slate-600"
          >
            Due date
          </label>
          <input
            id={`${idPrefix}-due`}
            type="date"
            value={values.dueDate}
            onChange={(e) =>
              setValues((v) => ({ ...v, dueDate: e.target.value }))
            }
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-folder`}
            className="text-xs font-medium text-slate-600"
          >
            Folder
          </label>
          <select
            id={`${idPrefix}-folder`}
            value={values.folderId}
            onChange={(e) =>
              setValues((v) => ({ ...v, folderId: e.target.value }))
            }
            className={inputClass}
          >
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600">Tags</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Select tags for this project. Tags can be reused across projects and
          tasks.
        </p>
        {allTags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {allTags.map((t) => (
              <label
                key={t._id}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                  values.tagIds.includes(t._id)
                    ? "border-accent-border bg-accent-soft text-accent-ink"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={values.tagIds.includes(t._id)}
                  onChange={() => toggleTag(t._id)}
                />
                {t.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            No tags yet — use the field below to create your first tag.
          </p>
        )}
        {workspaceId ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label
                htmlFor={`${idPrefix}-new-tag`}
                className="sr-only"
              >
                New tag name
              </label>
              <input
                id={`${idPrefix}-new-tag`}
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddTag();
                  }
                }}
                placeholder="New tag name"
                className={inputClass}
                disabled={tagCreateBusy}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleAddTag()}
              disabled={
                tagCreateBusy || !newTagName.trim() || !workspaceId
              }
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Add tag
            </button>
          </div>
        ) : null}
      </div>

      {showProgress ? (
        <div>
          <label
            htmlFor={`${idPrefix}-progress`}
            className="text-xs font-medium text-slate-600"
          >
            Progress ({values.progress}%)
          </label>
          <input
            id={`${idPrefix}-progress`}
            type="range"
            min={0}
            max={100}
            value={values.progress}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                progress: Number(e.target.value),
              }))
            }
            className="accent-[var(--workspace-accent)] mt-2 w-full"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy || !values.name.trim()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
