import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MentionTextField } from "@/components/mentions/MentionTextField";
import { ProjectSearchSelect } from "@/components/ui/ProjectSearchSelect";
import { NoteRichEditor } from "@/components/notes/NoteRichEditor";
import { NoteVoiceInput } from "@/components/notes/NoteVoiceInput";
import { bodyToHtmlForEditor, htmlToPlainText } from "@/lib/note-html";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { cn } from "@/lib/cn";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

type Props = {
  open: boolean;
  onClose: () => void;
  /** When null, modal creates a new note. */
  note: Doc<"notes"> | null;
  workspaceId: Id<"workspaces">;
  /** When set, new notes are linked to this project (e.g. project detail page). */
  projectId?: Id<"projects">;
  projectName?: string;
  /** Called after a new note is saved (with its id). */
  onCreated?: (noteId: Id<"notes">) => void;
};

export function NoteEditModal({
  open,
  onClose,
  note,
  workspaceId,
  projectId,
  projectName,
  onCreated,
}: Props) {
  const { toast } = useToast();
  const createNote = useMutation(api.notes.create);
  const updateNote = useMutation(api.notes.update);
  const removeNote = useMutation(api.notes.remove);
  const projects = useQuery(
    api.projects.listByWorkspace,
    open && workspaceId && note === null && projectId === undefined
      ? { workspaceId }
      : "skip",
  );
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedProjectId, setSelectedProjectId] =
    useState<Id<"projects"> | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  /** Bumps when voice inserts text so the rich editor re-syncs from `body`. */
  const [editorKey, setEditorKey] = useState(0);

  const effectiveProjectId = useMemo(
    () => projectId ?? selectedProjectId ?? undefined,
    [projectId, selectedProjectId],
  );

  useEffect(() => {
    if (!open) return;
    if (note) {
      setTitle(note.title);
      setBody(note.body);
    } else {
      setTitle("");
      setBody("");
      setEditorKey(0);
      if (projectId === undefined) setSelectedProjectId(null);
    }
  }, [open, note, projectId]);

  function insertVoicePlainText(plain: string) {
    setBody((prev) => {
      const prevPlain = htmlToPlainText(prev);
      const merged = prevPlain.trim()
        ? `${prevPlain}\n\n${plain}`
        : plain;
      return bodyToHtmlForEditor(merged);
    });
    setEditorKey((k) => k + 1);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleteOpen) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, deleteOpen]);

  useEffect(() => {
    if (!open) setDeleteOpen(false);
  }, [open]);

  if (!open) return null;

  const isCreate = note === null;

  async function handleDeleteNote() {
    if (!note) return;
    setDeleteBusy(true);
    try {
      await removeNote({ noteId: note._id });
      toast("Note deleted");
      setDeleteOpen(false);
      onClose();
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = title.trim() || "Untitled note";
    const b = body.trim();
    setBusy(true);
    try {
      if (isCreate) {
        const noteId = await createNote({
          workspaceId,
          title: t,
          body: b,
          ...(effectiveProjectId ? { projectId: effectiveProjectId } : {}),
        });
        onCreated?.(noteId);
      } else {
        await updateNote({
          noteId: note._id,
          title: t,
          body: b,
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <ConfirmDialog
      open={deleteOpen}
      onClose={() => setDeleteOpen(false)}
      title="Delete note?"
      description="This note will be permanently removed."
      confirmLabel="Delete note"
      variant="danger"
      busy={deleteBusy}
      onConfirm={handleDeleteNote}
    />
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/25 p-4 pt-[8vh] backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="note-edit-title"
            className="text-lg font-semibold text-slate-900"
          >
            {isCreate ? "New note" : "Edit note"}
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
          {isCreate ? (
            projectId !== undefined ? (
              <>
                Project:{" "}
                <span className="font-medium text-slate-700">
                  {projectName ?? "—"}
                </span>
              </>
            ) : effectiveProjectId && projects ? (
              <>
                Project:{" "}
                <span className="font-medium text-slate-700">
                  {projects.find((p) => p._id === effectiveProjectId)?.name ??
                    "—"}
                </span>
              </>
            ) : (
              <span className="text-slate-500">No project linked</span>
            )
          ) : projectName ? (
            <>
              Project:{" "}
              <span className="font-medium text-slate-700">{projectName}</span>
            </>
          ) : (
            <span className="font-medium text-slate-700">Workspace</span>
          )}
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="ne-title"
              className="text-xs font-medium text-slate-600"
            >
              Title
            </label>
            <MentionTextField
              id="ne-title"
              value={title}
              onValueChange={setTitle}
              workspaceId={workspaceId}
              mentionEnabled={open}
              placeholder="Note title"
              className={inputClass}
              autoFocus
            />
          </div>
          {isCreate && projectId === undefined ? (
            <div>
              <label
                htmlFor="ne-project"
                className="text-xs font-medium text-slate-600"
              >
                Project
              </label>
              {projects === undefined ? (
                <div className="mt-1 h-10 animate-pulse rounded-xl bg-slate-100" />
              ) : (
                <ProjectSearchSelect
                  id="ne-project"
                  projects={projects}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                />
              )}
            </div>
          ) : null}
          <div>
            <p className="text-xs font-medium text-slate-600">Content</p>
            {isCreate ? (
              <div className="mt-1">
                <NoteVoiceInput
                  onInsertPlainText={insertVoicePlainText}
                  disabled={busy}
                />
              </div>
            ) : null}
            <NoteRichEditor
              key={`${note?._id ?? "new"}-${editorKey}`}
              body={body}
              debounceMs={0}
              onSave={(html) => setBody(html)}
              className={cn(
                "mt-1 min-h-[min(20rem,45vh)]",
                isCreate && "mt-2",
              )}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            {!isCreate ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="rounded-xl px-2 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
              >
                Delete note
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
              >
                {isCreate ? "Create note" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
