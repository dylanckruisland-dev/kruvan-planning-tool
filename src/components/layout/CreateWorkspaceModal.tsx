import { useMutation } from "convex/react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";

type CreateWorkspaceModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called after a workspace is created; use to switch selection. */
  onCreated?: (workspaceId: Id<"workspaces">) => void;
};

export function CreateWorkspaceModal({
  open,
  onClose,
  onCreated,
}: CreateWorkspaceModalProps) {
  const create = useMutation(api.workspaces.create);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              New workspace
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              You can create up to 3 workspaces per account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const n = name.trim();
            if (!n) {
              setError("Please enter a name.");
              return;
            }
            setSubmitting(true);
            void create({ name: n })
              .then(({ workspaceId }) => {
                onCreated?.(workspaceId);
                onClose();
              })
              .catch((err: unknown) => {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not create workspace.",
                );
              })
              .finally(() => setSubmitting(false));
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Workspace name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-400 focus:ring-2"
              placeholder="e.g. My studio"
              autoFocus
            />
          </div>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[var(--workspace-accent,#4f46e5)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
