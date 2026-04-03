import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { MentionTextField } from "@/components/mentions/MentionTextField";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

type Idea = { title: string; notes: string };

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: Id<"workspaces">;
};

export function GenerateContentIdeasModal({
  open,
  onClose,
  workspaceId,
}: Props) {
  const generate = useAction(api.contentAi.generateContentIdeas);
  const createPlan = useMutation(api.contentPlans.create);

  const [businessType, setBusinessType] = useState("");
  const [contentFocus, setContentFocus] = useState("");
  const [background, setBackground] = useState("");
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Indices of ideas already saved to the board. */
  const [added, setAdded] = useState<Set<number>>(() => new Set());
  const [addingIndex, setAddingIndex] = useState<number | null>(null);

  const resetForm = useCallback(() => {
    setBusinessType("");
    setContentFocus("");
    setBackground("");
    setIdeas(null);
    setError(null);
    setAdded(new Set());
    setAddingIndex(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIdeas(null);
    setAdded(new Set());
    setLoading(true);
    try {
      const result = await generate({
        businessType,
        contentFocus,
        background,
      });
      setIdeas(result.ideas);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function addAsIdea(idea: Idea, index: number) {
    setAddingIndex(index);
    setError(null);
    try {
      await createPlan({
        workspaceId,
        title: idea.title,
        notes: idea.notes || undefined,
        platforms: ["other"],
        status: "idea",
      });
      setAdded((prev) => new Set(prev).add(index));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the idea.",
      );
    } finally {
      setAddingIndex(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-slate-900/25 p-4 pt-[8vh] backdrop-blur-sm [scrollbar-gutter:stable]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative mx-auto mb-10 w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gen-content-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="gen-content-title"
            className="text-lg font-semibold text-slate-900"
          >
            Generate content
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
          Describe your business and context. AI suggests ideas you can add to
          the Ideas column.
        </p>

        <form onSubmit={(e) => void handleGenerate(e)} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="gen-business"
              className="text-xs font-medium text-slate-600"
            >
              Business / industry
            </label>
            <MentionTextField
              id="gen-business"
              value={businessType}
              onValueChange={setBusinessType}
              workspaceId={workspaceId}
              mentionEnabled={open}
              className={inputClass}
              placeholder="e.g. Beach bar, B2B SaaS, fitness studio"
              maxLength={800}
              required
            />
          </div>
          <div>
            <label
              htmlFor="gen-focus"
              className="text-xs font-medium text-slate-600"
            >
              Type of content
            </label>
            <MentionTextField
              id="gen-focus"
              value={contentFocus}
              onValueChange={setContentFocus}
              workspaceId={workspaceId}
              mentionEnabled={open}
              className={inputClass}
              placeholder="e.g. Short-form video, carousels, newsletter snippets"
              maxLength={800}
              required
            />
          </div>
          <div>
            <label
              htmlFor="gen-bg"
              className="text-xs font-medium text-slate-600"
            >
              Background (optional)
            </label>
            <MentionTextField
              multiline
              id="gen-bg"
              value={background}
              onValueChange={setBackground}
              workspaceId={workspaceId}
              mentionEnabled={open}
              rows={4}
              maxLength={800}
              placeholder="Audience, tone of voice, goals, constraints…"
              className={`${inputClass} resize-none`}
            />
          </div>
          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate ideas"}
          </button>
        </form>

        {ideas && ideas.length > 0 ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-600">Suggestions</p>
            <ul className="mt-3 space-y-3">
              {ideas.map((idea, index) => {
                const isAdded = added.has(index);
                return (
                  <li
                    key={`${idea.title}-${index}`}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {idea.title}
                    </p>
                    {idea.notes ? (
                      <p className="mt-1 text-xs text-slate-600">{idea.notes}</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={isAdded || addingIndex === index}
                      onClick={() => void addAsIdea(idea, index)}
                      className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isAdded
                        ? "Added to Ideas"
                        : addingIndex === index
                          ? "Adding…"
                          : "Add as idea"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
