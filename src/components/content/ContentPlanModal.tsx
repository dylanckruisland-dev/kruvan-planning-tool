import { Paperclip, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { useToast } from "@/contexts/ToastContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  PLATFORM_PRESETS,
  CONTENT_PLATFORM_LABEL,
  CONTENT_STATUS_LABEL,
  isImageContentType,
  isVideoContentType,
  type ContentPlatform,
  type ContentStatus,
} from "@/lib/content-plan";
import {
  datetimeLocalToTimestamp,
  timestampToDatetimeLocal,
} from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { Doc, Id } from "@cvx/_generated/dataModel";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

type ContentAttachment = NonNullable<
  Doc<"contentPlans">["attachments"]
>[number];

type ProjectOption = { _id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  plan: Doc<"contentPlans"> | null;
  workspaceId: Id<"workspaces">;
  createInitialStatus?: ContentStatus;
  /** When opening "new" from the content calendar (slot / day click). */
  createPresetScheduledFor?: number;
  /** Workspace projects for optional assignment (Content page). */
  projects?: ProjectOption[];
  /** When set (project detail), project is fixed like notes — not shown in update payload. */
  lockProjectId?: Id<"projects">;
  lockProjectName?: string;
};

export function ContentPlanModal({
  open,
  onClose,
  plan,
  workspaceId,
  createInitialStatus = "idea",
  createPresetScheduledFor,
  projects,
  lockProjectId,
  lockProjectName,
}: Props) {
  const { toast } = useToast();
  const createPlan = useMutation(api.contentPlans.create);
  const updatePlan = useMutation(api.contentPlans.update);
  const removePlan = useMutation(api.contentPlans.remove);
  const generateUploadUrl = useMutation(api.contentPlans.generateUploadUrl);
  const deleteStoredFile = useMutation(api.contentPlans.deleteStoredFile);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [contentFormat, setContentFormat] = useState("");
  const [platforms, setPlatforms] = useState<ContentPlatform[]>([]);
  const [customPlatforms, setCustomPlatforms] = useState<string[]>([]);
  const [customPlatformDraft, setCustomPlatformDraft] = useState("");
  const [status, setStatus] = useState<ContentStatus>("idea");
  const [scheduledFor, setScheduledFor] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [attachments, setAttachments] = useState<ContentAttachment[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [projectIdSelect, setProjectIdSelect] = useState("");
  /** Immediate preview URLs (Convex signed URLs can lag; blobs always show). */
  const [blobPreviews, setBlobPreviews] = useState<Map<string, string>>(
    () => new Map(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filePickInFlight = useRef(false);

  /** Avoid resetting local state when `plan` is a new object ref on every Convex list refresh. */
  const syncedPlanKeyRef = useRef<string | null>(null);

  const planIdStr = plan ? String(plan._id) : null;

  const isCreate = plan === null;

  const storageIds = useMemo(
    () => attachments.map((a) => a.storageId),
    [attachments],
  );
  const urlRows = useQuery(
    api.contentPlans.getAttachmentUrls,
    open && storageIds.length ? { storageIds } : "skip",
  );
  const urlById = useMemo(() => {
    const m = new Map<string, string>();
    if (urlRows) {
      for (const r of urlRows) {
        if (r.url) m.set(String(r.storageId), r.url);
      }
    }
    return m;
  }, [urlRows]);

  useEffect(() => {
    if (!open) {
      syncedPlanKeyRef.current = null;
      setBlobPreviews((prev) => {
        for (const u of prev.values()) URL.revokeObjectURL(u);
        return new Map();
      });
      return;
    }
    const key = planIdStr
      ? `edit:${planIdStr}:${plan?.projectId ? String(plan.projectId) : ""}:${plan?.contentFormat ?? ""}:${JSON.stringify(plan?.customPlatforms ?? [])}`
      : `create:${createInitialStatus}:${createPresetScheduledFor ?? ""}:lock:${lockProjectId ?? ""}`;
    if (syncedPlanKeyRef.current === key) return;
    syncedPlanKeyRef.current = key;
    setUploadError(null);
    setBlobPreviews((prev) => {
      for (const u of prev.values()) URL.revokeObjectURL(u);
      return new Map();
    });
    if (plan) {
      setTitle(plan.title);
      setNotes(plan.notes ?? "");
      setContentFormat(plan.contentFormat ?? "");
      setPlatforms(
        plan.platforms.filter((p) => p !== "other"),
      );
      setCustomPlatforms(
        plan.customPlatforms?.length ? [...plan.customPlatforms] : [],
      );
      setStatus(plan.status);
      setScheduledFor(
        plan.scheduledFor != null
          ? timestampToDatetimeLocal(plan.scheduledFor)
          : "",
      );
      setPublishedAt(
        plan.publishedAt != null
          ? timestampToDatetimeLocal(plan.publishedAt)
          : "",
      );
      setAttachments(plan.attachments ? [...plan.attachments] : []);
      setProjectIdSelect(
        plan.projectId ? String(plan.projectId) : "",
      );
    } else {
      setTitle("");
      setNotes("");
      setContentFormat("");
      setPlatforms(["other"]);
      setCustomPlatforms([]);
      setStatus(createInitialStatus);
      setScheduledFor(
        createPresetScheduledFor != null
          ? timestampToDatetimeLocal(createPresetScheduledFor)
          : "",
      );
      setPublishedAt("");
      setAttachments([]);
      setProjectIdSelect("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `plan` is read only when open/planIdStr/createInitialStatus change; omitting `plan` avoids wiping uploads on Convex list refresh.
  }, [
    open,
    planIdStr,
    createInitialStatus,
    createPresetScheduledFor,
    lockProjectId,
    plan?.projectId,
    plan?.contentFormat,
    plan?.customPlatforms,
  ]);

  useEffect(() => {
    if (!open) setDeleteOpen(false);
  }, [open]);

  const handleDismiss = useCallback(() => {
    if (plan) {
      const persisted = new Set(
        (plan.attachments ?? []).map((a) => String(a.storageId)),
      );
      for (const a of attachments) {
        if (!persisted.has(String(a.storageId))) {
          void deleteStoredFile({ storageId: a.storageId });
        }
      }
    } else {
      for (const a of attachments) {
        void deleteStoredFile({ storageId: a.storageId });
      }
    }
    onClose();
  }, [plan, attachments, onClose, deleteStoredFile]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleteOpen) handleDismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, deleteOpen, handleDismiss]);

  if (!open) return null;

  function togglePlatform(id: ContentPlatform) {
    setPlatforms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function addCustomPlatform() {
    const t = customPlatformDraft.trim();
    if (!t) return;
    setCustomPlatforms((prev) => {
      if (prev.length >= 12) return prev;
      const lower = t.toLowerCase();
      if (prev.some((x) => x.toLowerCase() === lower)) return prev;
      return [...prev, t.slice(0, 40)];
    });
    setCustomPlatformDraft("");
  }

  function removeCustomPlatform(label: string) {
    setCustomPlatforms((prev) => prev.filter((x) => x !== label));
  }

  function removeAttachmentAt(index: number) {
    const a = attachments[index];
    if (!a) return;
    const wasPersisted = plan?.attachments?.some(
      (x) => x.storageId === a.storageId,
    );
    const sid = String(a.storageId);
    setBlobPreviews((prev) => {
      const u = prev.get(sid);
      if (u) URL.revokeObjectURL(u);
      const next = new Map(prev);
      next.delete(sid);
      return next;
    });
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    if (!wasPersisted) {
      void deleteStoredFile({ storageId: a.storageId });
    }
  }

  function guessContentType(file: File): string | undefined {
    if (file.type) return file.type;
    const lower = file.name.toLowerCase();
    const dot = lower.lastIndexOf(".");
    const ext = dot >= 0 ? lower.slice(dot) : "";
    const byExt: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".heic": "image/heic",
      ".heif": "image/heif",
      ".bmp": "image/bmp",
      ".svg": "image/svg+xml",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".m4v": "video/x-m4v",
    };
    return byExt[ext];
  }

  async function parseStorageIdFromResponse(
    res: Response,
  ): Promise<string | null> {
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as { storageId?: unknown };
      if (typeof parsed.storageId === "string" && parsed.storageId.length > 0) {
        return parsed.storageId;
      }
    } catch {
      return null;
    }
    return null;
  }

  async function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (filePickInFlight.current) return;
    const files = e.target.files;
    if (!files?.length) return;
    filePickInFlight.current = true;
    setUploadBusy(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const postUrl = await generateUploadUrl();
        if (typeof postUrl !== "string" || !postUrl.startsWith("http")) {
          setUploadError("Could not get upload URL. Is Convex running?");
          continue;
        }
        const inferred = guessContentType(file);
        const contentType =
          file.type || inferred || "application/octet-stream";
        const res = await fetch(postUrl, {
          method: "POST",
          headers: {
            "Content-Type": contentType,
          },
          body: file,
        });
        const storageIdRaw = await parseStorageIdFromResponse(res);
        if (!res.ok || !storageIdRaw) {
          setUploadError(
            res.ok
              ? "Upload response was invalid. Try again or check the browser console."
              : `Upload failed (HTTP ${res.status}). Check your connection and Convex dev/prod URL.`,
          );
          continue;
        }
        const ct = file.type || inferred;
        const id = storageIdRaw as Id<"_storage">;
        const blobUrl = URL.createObjectURL(file);
        setBlobPreviews((prev) => {
          const next = new Map(prev);
          next.set(String(id), blobUrl);
          return next;
        });
        setAttachments((prev) => [
          ...prev,
          {
            storageId: id,
            name: file.name,
            contentType: ct,
          },
        ]);
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Try again.",
      );
    } finally {
      filePickInFlight.current = false;
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!plan) return;
    setDeleteBusy(true);
    try {
      await removePlan({ contentPlanId: plan._id });
      toast("Content item deleted");
      setDeleteOpen(false);
      onClose();
    } finally {
      setDeleteBusy(false);
    }
  }

  /** Enter in the custom-platform field submits the form; handle that before save (avoids stale state). */
  function onFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ae = document.activeElement as HTMLElement | null;
    if (ae?.dataset?.customPlatformInput === "true") {
      addCustomPlatform();
      return;
    }
    void handleSubmit(e);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const sched =
      scheduledFor.trim() === ""
        ? undefined
        : datetimeLocalToTimestamp(scheduledFor);
    const pub =
      publishedAt.trim() === ""
        ? undefined
        : datetimeLocalToTimestamp(publishedAt);
    if (sched !== undefined && Number.isNaN(sched)) return;
    if (pub !== undefined && Number.isNaN(pub)) return;

    const presetOnly = platforms.filter((p) => p !== "other");
    const presetPlatforms = (
      presetOnly.length > 0
        ? presetOnly
        : customPlatforms.length > 0
          ? []
          : ["other"]
    ) as Doc<"contentPlans">["platforms"];

    const attachPayload =
      attachments.length > 0 ? attachments : undefined;
    const formatTrim = contentFormat.trim();

    setBusy(true);
    try {
      if (isCreate) {
        const createPid =
          lockProjectId ??
          (projectIdSelect
            ? (projectIdSelect as Id<"projects">)
            : undefined);
        await createPlan({
          workspaceId,
          title: title.trim(),
          notes: notes.trim() || undefined,
          contentFormat: formatTrim || undefined,
          platforms: presetPlatforms,
          customPlatforms,
          status,
          scheduledFor: sched,
          publishedAt: pub,
          ...(createPid ? { projectId: createPid } : {}),
          ...(attachPayload ? { attachments: attachPayload } : {}),
        });
      } else {
        await updatePlan({
          contentPlanId: plan._id,
          title: title.trim(),
          notes: notes.trim() || null,
          contentFormat: formatTrim === "" ? null : formatTrim,
          platforms: presetPlatforms,
          customPlatforms,
          status,
          scheduledFor: sched === undefined ? null : sched,
          publishedAt: pub === undefined ? null : pub,
          attachments: attachPayload ?? [],
          ...(!lockProjectId
            ? {
                projectId:
                  projectIdSelect === ""
                    ? null
                    : (projectIdSelect as Id<"projects">),
              }
            : {}),
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
        title="Delete this content?"
        description="This item will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
        busy={deleteBusy}
        onConfirm={handleDelete}
      />
      <div
        className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-slate-900/25 p-4 pt-[8vh] backdrop-blur-sm [scrollbar-gutter:stable]"
        role="presentation"
        onClick={handleDismiss}
      >
        <div
          className="relative mx-auto mb-10 w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="content-plan-title"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose photos or videos to upload"
            onChange={(e) => void onFileInputChange(e)}
            onInput={(e) =>
              void onFileInputChange(
                e as unknown as React.ChangeEvent<HTMLInputElement>,
              )
            }
          />
          <div className="flex items-start justify-between gap-3">
            <h2
              id="content-plan-title"
              className="text-lg font-semibold text-slate-900"
            >
              {isCreate ? "New content" : "Edit content"}
            </h2>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {lockProjectId && lockProjectName ? (
            <p className="mt-1 text-xs text-slate-500">
              Project:{" "}
              <span className="font-medium text-slate-700">
                {lockProjectName}
              </span>
            </p>
          ) : null}

          <form
            onSubmit={onFormSubmit}
            className="mt-5 space-y-4"
          >
            <div>
              <label
                htmlFor="cp-title"
                className="text-xs font-medium text-slate-600"
              >
                Title <span className="text-rose-600">*</span>
              </label>
              <input
                id="cp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="Hook or working title"
                required
              />
            </div>

            {projects && projects.length > 0 && !lockProjectId ? (
              <div>
                <label
                  htmlFor="cp-project"
                  className="text-xs font-medium text-slate-600"
                >
                  Project
                </label>
                <select
                  id="cp-project"
                  value={projectIdSelect}
                  onChange={(e) => setProjectIdSelect(e.target.value)}
                  className={inputClass}
                >
                  <option value="">None (workspace)</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label
                htmlFor="cp-notes"
                className="text-xs font-medium text-slate-600"
              >
                Notes / caption ideas
              </label>
              <textarea
                id="cp-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Outline, script beats, hashtags…"
                className={cn(inputClass, "resize-none")}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-600">
                  Photos & videos
                </p>
                <button
                  type="button"
                  disabled={uploadBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {uploadBusy ? "Uploading…" : "Add files"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Upload reference clips, thumbnails, or rough cuts. Files are stored in your workspace.
              </p>
              {uploadError ? (
                <p className="mt-2 text-[11px] font-medium text-rose-600" role="alert">
                  {uploadError}
                </p>
              ) : null}
              {attachments.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {attachments.map((a, index) => {
                    const sid = String(a.storageId);
                    const url =
                      urlById.get(sid) ?? blobPreviews.get(sid);
                    return (
                      <li
                        key={`${String(a.storageId)}-${index}`}
                        className="overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/80"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-2 py-1.5">
                          <span className="min-w-0 truncate text-[11px] font-medium text-slate-700">
                            {a.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachmentAt(index)}
                            className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Remove file"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {url && isImageContentType(a.contentType) ? (
                          <img
                            src={url}
                            alt=""
                            className="max-h-48 w-full object-contain"
                          />
                        ) : null}
                        {url && isVideoContentType(a.contentType) ? (
                          <video
                            src={url}
                            className="max-h-48 w-full object-contain"
                            controls
                            playsInline
                          />
                        ) : null}
                        {url &&
                        !isImageContentType(a.contentType) &&
                        !isVideoContentType(a.contentType) ? (
                          <div className="px-2 py-3 text-center text-[11px] text-slate-500">
                            Preview not available —{" "}
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-accent hover:underline"
                            >
                              Open file
                            </a>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="cp-format"
                className="text-xs font-medium text-slate-600"
              >
                Format
              </label>
              <p className="mt-0.5 text-[11px] text-slate-500">
                What kind of content is this? Choose a suggestion or type your
                own.
              </p>
              <input
                id="cp-format"
                list="content-format-suggestions"
                value={contentFormat}
                onChange={(e) => setContentFormat(e.target.value)}
                className={inputClass}
                placeholder="e.g. Video, image, carousel, short video…"
                maxLength={120}
                autoComplete="off"
              />
              <datalist id="content-format-suggestions">
                <option value="Video" />
                <option value="Image" />
                <option value="Carousel" />
                <option value="Short video" />
                <option value="Reel" />
                <option value="Story" />
                <option value="Live" />
                <option value="Text post" />
              </datalist>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-600">Platforms</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PLATFORM_PRESETS.map((p) => (
                  <label
                    key={p}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      platforms.includes(p)
                        ? "border-accent-border bg-accent-soft text-accent-ink"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={platforms.includes(p)}
                      onChange={() => togglePlatform(p)}
                    />
                    {CONTENT_PLATFORM_LABEL[p]}
                  </label>
                ))}
                {customPlatforms.map((label) => (
                  <span
                    key={`custom-${label}`}
                    className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-accent-border bg-accent-soft pl-2.5 pr-1 py-1 text-xs font-medium text-accent-ink"
                  >
                    <span className="truncate">{label}</span>
                    <button
                      type="button"
                      onClick={() => removeCustomPlatform(label)}
                      className="shrink-0 rounded p-0.5 text-accent-ink/70 transition hover:bg-accent-soft hover:text-accent-ink"
                      aria-label={`Remove ${label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Add any other channel (email, website, Snapchat…), then Enter
                or Add.
              </p>
              <div className="mt-1.5 flex min-w-0 max-w-md items-center gap-1.5">
                <input
                  type="text"
                  name="customPlatformDraft"
                  data-custom-platform-input="true"
                  value={customPlatformDraft}
                  onChange={(e) => setCustomPlatformDraft(e.target.value)}
                  autoComplete="off"
                  placeholder="Add channel…"
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 input-focus-accent"
                />
                <button
                  type="button"
                  onClick={() => addCustomPlatform()}
                  className="shrink-0 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="cp-status"
                className="text-xs font-medium text-slate-600"
              >
                Status
              </label>
              <select
                id="cp-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as ContentStatus)
                }
                className={inputClass}
              >
                {(Object.keys(CONTENT_STATUS_LABEL) as ContentStatus[]).map(
                  (s) => (
                    <option key={s} value={s}>
                      {CONTENT_STATUS_LABEL[s]}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cp-sched"
                  className="text-xs font-medium text-slate-600"
                >
                  Scheduled for
                </label>
                <input
                  id="cp-sched"
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="cp-pub"
                  className="text-xs font-medium text-slate-600"
                >
                  Published at
                </label>
                <input
                  id="cp-pub"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              {!isCreate ? (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="rounded-xl px-2 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !title.trim()}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
                >
                  {isCreate ? "Create" : "Save"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
