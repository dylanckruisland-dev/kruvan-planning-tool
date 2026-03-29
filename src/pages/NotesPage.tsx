import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { NoteCard } from "@/components/notes/NoteCard";
import { useToast } from "@/contexts/ToastContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/cn";
import type { Id } from "@cvx/_generated/dataModel";
import { NoteEditModal } from "@/components/notes/NoteEditModal";
import { NoteRichEditor } from "@/components/notes/NoteRichEditor";
import { Plus, StickyNote } from "lucide-react";

type NoteSort = "updated_desc" | "updated_asc";

export function NotesPage() {
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();
  const { note: noteFromUrl } = useSearch({ from: "/notes" });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<NoteSort>("updated_desc");
  const [selected, setSelected] = useState<string | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<Id<"notes"> | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (noteFromUrl) {
      setSelected(noteFromUrl);
      setSearch("");
    }
  }, [noteFromUrl]);
  const notes = useQuery(
    api.notes.listByWorkspace,
    workspaceId
      ? { workspaceId, search: search || undefined }
      : "skip",
  );
  const projects = useQuery(
    api.projects.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const updateNote = useMutation(api.notes.update);
  const removeNote = useMutation(api.notes.remove);

  const projectName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects ?? []) {
      m.set(String(p._id), p.name);
    }
    return m;
  }, [projects]);

  const sortedNotes = useMemo(() => {
    if (!notes) return [];
    const arr = [...notes];
    arr.sort((a, b) => {
      const cmp = a.updatedAt - b.updatedAt;
      return sort === "updated_desc" ? -cmp : cmp;
    });
    return arr;
  }, [notes, sort]);

  const active =
    sortedNotes.find((n) => String(n._id) === selected) ?? sortedNotes[0];

  async function confirmDeleteNote() {
    if (!deleteNoteId || !notes) return;
    const wasSelected = selected === String(deleteNoteId);
    const remaining = sortedNotes.filter((n) => n._id !== deleteNoteId);
    setDeleteBusy(true);
    try {
      await removeNote({ noteId: deleteNoteId });
      toast("Note deleted");
      setDeleteNoteId(null);
      if (remaining.length === 0) setSelected(null);
      else if (wasSelected) setSelected(String(remaining[0]._id));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!workspaceId || notes === undefined) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />;
  }

  return (
    <div className="space-y-6">
      {workspaceId ? (
        <NoteEditModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          note={null}
          workspaceId={workspaceId}
          onCreated={(id) => {
            setSelected(String(id));
            setSearch("");
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleteNoteId !== null}
        onClose={() => setDeleteNoteId(null)}
        title="Delete note?"
        description="This note will be permanently removed."
        confirmLabel="Delete note"
        variant="danger"
        busy={deleteBusy}
        onConfirm={confirmDeleteNote}
      />
      <SectionHeader
        title="Notes"
        description="Capture thinking, link notes to projects, and keep previews scannable."
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search notes…"
            className="max-w-md"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="shrink-0 font-medium">Last edited</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as NoteSort)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none input-focus-accent"
            >
              <option value="updated_desc">Newest first</option>
              <option value="updated_asc">Oldest first</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Add note
        </button>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet"
          description="Add a note to capture ideas, or use Quick add from anywhere."
          action={
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add note
            </button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:min-h-[calc(100vh-11rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-stretch">
          <div className="min-h-0 space-y-2 overflow-y-auto pr-0.5 lg:max-h-none">
            {sortedNotes.map((n) => (
              <NoteCard
                key={n._id}
                note={n}
                projectName={
                  n.projectId
                    ? projectName.get(String(n.projectId))
                    : undefined
                }
                selected={
                  selected === String(n._id) ||
                  (!selected && sortedNotes[0]?._id === n._id)
                }
                onClick={() => setSelected(String(n._id))}
                onDelete={() => setDeleteNoteId(n._id)}
              />
            ))}
          </div>
          <div
            className={cn(
              "flex min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:h-full lg:min-h-0",
            )}
          >
            {active ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <input
                  value={active.title}
                  onChange={(e) =>
                    void updateNote({
                      noteId: active._id,
                      title: e.target.value,
                    })
                  }
                  className="shrink-0 border-b border-transparent bg-transparent text-lg font-semibold text-slate-900 outline-none focus:border-slate-200"
                />
                <NoteRichEditor
                  key={String(active._id)}
                  body={active.body}
                  onSave={(html) =>
                    void updateNote({ noteId: active._id, body: html })
                  }
                  className="mt-4 flex min-h-0 flex-1 flex-col"
                />
                <div className="mt-4 flex shrink-0 justify-end border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setDeleteNoteId(active._id)}
                    className="rounded-xl px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    Delete note
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
