import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@cvx/_generated/api";

export function CreateFirstWorkspace() {
  const create = useMutation(api.workspaces.create);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#f6f7f9] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          Your first workspace
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose a name for your planning space (e.g. your company or team).
        </p>
        <form
          className="mt-6 space-y-4"
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
              .catch((err: unknown) => {
                setError(
                  err instanceof Error ? err.message : "Could not create workspace.",
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
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          )}
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
