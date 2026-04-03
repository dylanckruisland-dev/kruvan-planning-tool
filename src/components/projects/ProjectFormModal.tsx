import { X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@cvx/_generated/api";
import { ProjectForm } from "@/components/projects/ProjectForm";
import {
  emptyProjectFormValues,
  type ProjectFormValues,
} from "@/lib/project-form";
import { dateInputValueToTimestamp } from "@/lib/dates";
import { projectDetailDefaultSearch } from "@/lib/router-search-defaults";
import type { Doc, Id } from "@cvx/_generated/dataModel";

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: Id<"workspaces">;
  defaultFolderId?: string;
  tags: Doc<"tags">[];
  folders: Doc<"folders">[];
};

export function ProjectFormModal({
  open,
  onClose,
  workspaceId,
  defaultFolderId,
  tags,
  folders,
}: Props) {
  const navigate = useNavigate();
  const createProject = useMutation(api.projects.create);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function onSubmit(values: ProjectFormValues) {
    setBusy(true);
    try {
      const id = await createProject({
        workspaceId,
        folderId: values.folderId
          ? (values.folderId as Id<"folders">)
          : undefined,
        name: values.name,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        dueDate: dateInputValueToTimestamp(values.dueDate),
        progress: values.progress,
        tagIds: values.tagIds.map((x) => x as Id<"tags">),
      });
      onClose();
      navigate({
        to: "/projects/$projectId",
        params: { projectId: String(id) },
        search: { ...projectDetailDefaultSearch },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/25 p-4 pt-[10vh] backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="project-modal-title"
            className="text-lg font-semibold text-slate-900"
          >
            New project
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
        <p className="mt-1 text-sm text-slate-500">
          Name your project and set status, priority, dates, folder, and tags.
        </p>
        <div className="mt-5">
          <ProjectForm
            initial={emptyProjectFormValues(defaultFolderId)}
            workspaceId={workspaceId}
            tags={tags.map((t) => ({ _id: String(t._id), name: t.name }))}
            folders={folders.map((f) => ({ _id: String(f._id), name: f.name }))}
            onSubmit={onSubmit}
            submitLabel="Create project"
            busy={busy}
            idPrefix="new-project"
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
