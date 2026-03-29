import { Link } from "@tanstack/react-router";
import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import {
  datetimeLocalToTimestamp,
  timestampToDatetimeLocal,
} from "@/lib/dates";
import type { Id } from "@cvx/_generated/dataModel";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

type Props = {
  onClose: () => void;
  workspaceId: Id<"workspaces">;
  /** Set when editing an existing event. */
  eventId?: Id<"events">;
  /** Linked task (read-only link in edit mode). */
  linkedTaskId?: Id<"tasks">;
  initialTitle?: string;
  initialDescription?: string;
  /** When opening from a slot or “Add”, pre-fill start/end (ms). */
  initialStart?: number;
  initialEnd?: number;
};

export function EventFormModal({
  onClose,
  workspaceId,
  eventId,
  linkedTaskId,
  initialTitle,
  initialDescription,
  initialStart,
  initialEnd,
}: Props) {
  const createEvent = useMutation(api.events.create);
  const updateEvent = useMutation(api.events.update);
  const removeEvent = useMutation(api.events.remove);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEdit = Boolean(eventId);

  useEffect(() => {
    const now = Date.now();
    const start = initialStart ?? now;
    const end = initialEnd ?? start + 60 * 60 * 1000;
    setTitle(initialTitle?.trim() ? initialTitle : "");
    setDescription(initialDescription ?? "");
    setStartLocal(timestampToDatetimeLocal(start));
    setEndLocal(timestampToDatetimeLocal(end));
    setSaveError(null);
  }, [
    eventId,
    initialTitle,
    initialDescription,
    initialStart,
    initialEnd,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);


  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    const startTime = datetimeLocalToTimestamp(startLocal);
    const endTime = datetimeLocalToTimestamp(endLocal);
    if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
      setSaveError("Invalid date or time.");
      return;
    }
    if (!title.trim() || endTime <= startTime) return;
    setBusy(true);
    try {
      if (eventId) {
        await updateEvent({
          eventId,
          title: title.trim(),
          description: description.trim(),
          startTime,
          endTime,
        });
      } else {
        const desc = description.trim() || undefined;
        await createEvent({
          workspaceId,
          title: title.trim(),
          description: desc,
          startTime,
          endTime,
        });
      }
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not save. Try again.";
      setSaveError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!eventId) return;
    if (
      !window.confirm(
        "This event will be removed from the agenda. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await removeEvent({ eventId });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/25 p-4 pt-[8vh] backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="event-form-title"
            className="text-lg font-semibold text-slate-900"
          >
            {isEdit ? "Edit event" : "New event"}
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
          {isEdit
            ? "Update this calendar block or remove it from the agenda."
            : "Add a block to your workspace calendar."}
        </p>
        {saveError ? (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {saveError}
          </p>
        ) : null}

        {isEdit && linkedTaskId ? (
          <p className="mt-3 text-xs text-slate-600">
            Linked task:{" "}
            <Link
              to="/tasks"
              search={{ task: String(linkedTaskId), taskView: "list" }}
              className="font-medium text-accent underline-offset-2 hover:text-accent-strong hover:underline"
              onClick={onClose}
            >
              Open in Tasks
            </Link>
          </p>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="ev-title"
              className="text-xs font-medium text-slate-600"
            >
              Title <span className="text-rose-600">*</span>
            </label>
            <input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting, focus block…"
              className={inputClass}
              required
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="ev-desc"
              className="text-xs font-medium text-slate-600"
            >
              Description
            </label>
            <textarea
              id="ev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional details"
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ev-start"
                className="text-xs font-medium text-slate-600"
              >
                Start
              </label>
              <input
                id="ev-start"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label
                htmlFor="ev-end"
                className="text-xs font-medium text-slate-600"
              >
                End
              </label>
              <input
                id="ev-end"
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            {isEdit ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  busy ||
                  !title.trim() ||
                  (() => {
                    const s = datetimeLocalToTimestamp(startLocal);
                    const en = datetimeLocalToTimestamp(endLocal);
                    return (
                      Number.isNaN(s) ||
                      Number.isNaN(en) ||
                      en <= s
                    );
                  })()
                }
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
              >
                {isEdit ? "Save changes" : "Add to agenda"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
