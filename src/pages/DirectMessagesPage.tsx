import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Loader2,
  Mail,
  MessageSquarePlus,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTabTitle } from "@/hooks/useTabTitle";
import { useWorkspaceDisplay } from "@/hooks/useWorkspaceDisplay";
import { cn } from "@/lib/cn";

function NewDmModal({
  open,
  onClose,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  onStarted: (conversationId: Id<"conversations">) => void;
}) {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 220);
  const results = useQuery(
    api.dm.searchUsers,
    open && debounced.trim().length >= 2
      ? { query: debounced }
      : "skip",
  );
  const getOrCreate = useMutation(api.dm.getOrCreateConversation);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setQ("");
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
    <div className="fixed inset-0 z-[140] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 flex max-h-[min(90dvh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">New message</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-slate-100 px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none input-focus-accent"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Type at least 2 characters
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {debounced.trim().length < 2 ? (
            <li className="px-3 py-8 text-center text-xs text-slate-500">
              Search for someone on Kruvan
            </li>
          ) : results === undefined ? (
            <li className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-8 text-center text-xs text-slate-500">
              No users match your search
            </li>
          ) : (
            results.map((u) => (
              <li key={String(u.userId)}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        const { conversationId } = await getOrCreate({
                          otherUserId: u.userId,
                        });
                        onStarted(conversationId);
                        onClose();
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                    {(u.name || u.email || "?").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">
                      {u.name}
                    </span>
                    {u.email ? (
                      <span className="block truncate text-[11px] text-slate-500">
                        {u.email}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

type MergedRow =
  | {
      kind: "team";
      lastAt: number;
      preview: string;
      title: string;
    }
  | {
      kind: "dm";
      conversationId: Id<"conversations">;
      lastAt: number;
      preview: string;
      otherName: string;
    };

export function DirectMessagesPage() {
  const navigate = useNavigate({ from: "/messages" });
  const { conversation: conversationParam, team: teamParam } = useSearch({
    from: "/messages",
  });
  const { workspaceId, workspace, workspaceName } = useWorkspace();

  const conversationId =
    conversationParam && conversationParam.length > 0
      ? (conversationParam as Id<"conversations">)
      : undefined;

  const teamWorkspaceId =
    workspaceId &&
    teamParam &&
    teamParam.length > 0 &&
    teamParam === String(workspaceId)
      ? workspaceId
      : undefined;

  const isTeamThread = Boolean(teamWorkspaceId);

  useEffect(() => {
    if (conversationParam && teamParam) {
      void navigate({
        to: "/messages",
        search: { conversation: conversationParam, team: undefined },
        replace: true,
      });
      return;
    }
    if (!teamParam) return;
    if (!workspaceId || teamParam !== String(workspaceId)) {
      void navigate({
        to: "/messages",
        search: {
          conversation: conversationParam,
          team: undefined,
        },
        replace: true,
      });
    }
  }, [
    workspaceId,
    teamParam,
    conversationParam,
    navigate,
  ]);

  const viewer = useQuery(api.users.viewer);
  const conversations = useQuery(api.dm.listConversations);
  const thread = useQuery(
    api.dm.listMessages,
    conversationId && !isTeamThread ? { conversationId } : "skip",
  );
  const teamThread = useQuery(
    api.dm.listWorkspaceTeamMessages,
    teamWorkspaceId ? { workspaceId: teamWorkspaceId } : "skip",
  );
  const header = useQuery(
    api.dm.getConversation,
    conversationId && !isTeamThread ? { conversationId } : "skip",
  );
  const send = useMutation(api.dm.send);
  const sendTeam = useMutation(api.dm.sendWorkspaceTeamMessage);
  const { formatTime, formatShortDate } = useWorkspaceDisplay();

  const messagesTabTitle = useMemo(() => {
    if (isTeamThread) return `Team · ${workspaceName ?? "Workspace"}`;
    if (conversationId && header) return header.otherName;
    return "Messages";
  }, [isTeamThread, workspaceName, conversationId, header]);
  useTabTitle(messagesTabTitle);

  const mergedRows = useMemo((): MergedRow[] => {
    const rows: MergedRow[] = [];
    if (workspaceId) {
      rows.push({
        kind: "team",
        lastAt: workspace?.teamChatLastAt ?? 0,
        preview: workspace?.teamChatPreview ?? "",
        title: workspaceName ?? workspace?.name ?? "Workspace",
      });
    }
    if (conversations) {
      for (const c of conversations) {
        rows.push({
          kind: "dm",
          conversationId: c.conversationId,
          lastAt: c.lastMessageAt,
          preview: c.preview,
          otherName: c.otherName,
        });
      }
    }
    rows.sort((a, b) => b.lastAt - a.lastAt);
    return rows;
  }, [workspaceId, workspaceName, workspace, conversations]);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const skipSmoothScroll = useRef(true);

  const activeThread = Boolean(conversationId || teamWorkspaceId);

  useEffect(() => {
    skipSmoothScroll.current = true;
  }, [conversationId, teamWorkspaceId]);

  const displayMessages = isTeamThread ? teamThread : thread;

  useLayoutEffect(() => {
    if (!displayMessages?.length) return;
    bottomRef.current?.scrollIntoView({
      behavior: skipSmoothScroll.current ? "auto" : "smooth",
    });
    skipSmoothScroll.current = false;
  }, [displayMessages]);

  const viewerId = viewer?._id;

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending) return;
    if (isTeamThread) {
      if (!teamWorkspaceId) return;
      setSending(true);
      try {
        await sendTeam({ workspaceId: teamWorkspaceId, body: draft });
        setDraft("");
        skipSmoothScroll.current = false;
      } finally {
        setSending(false);
      }
      return;
    }
    if (!conversationId) return;
    setSending(true);
    try {
      await send({ conversationId, body: draft });
      setDraft("");
      skipSmoothScroll.current = false;
    } finally {
      setSending(false);
    }
  }, [
    conversationId,
    draft,
    sending,
    send,
    isTeamThread,
    teamWorkspaceId,
    sendTeam,
  ]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleSend();
  }

  function selectConversation(id: Id<"conversations">) {
    void navigate({
      to: "/messages",
      search: { conversation: String(id), team: undefined },
    });
  }

  function selectTeamChannel() {
    if (!workspaceId) return;
    void navigate({
      to: "/messages",
      search: { conversation: undefined, team: String(workspaceId) },
    });
  }

  function clearThread() {
    void navigate({
      to: "/messages",
      search: { conversation: undefined, team: undefined },
    });
  }

  function dayKey(ts: number) {
    return formatShortDate(ts);
  }

  const listLoading = conversations === undefined;
  const threadLoading = isTeamThread
    ? teamThread === undefined
    : conversationId
      ? thread === undefined || header === undefined
      : false;

  return (
    <div className="flex min-h-[min(100dvh-8rem,760px)] flex-col gap-4">
      <SectionHeader
        title="Messages"
        description="Direct messages with other users, and a team channel to reach everyone in the current workspace at once."
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100/80 lg:flex-row">
        <aside
          className={cn(
            "flex max-h-[45vh] flex-col border-slate-200/80 lg:max-h-none lg:w-[min(100%,320px)] lg:border-r",
            activeThread && "max-lg:hidden",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Conversations
            </span>
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            ) : mergedRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <Mail className="h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-500">
                  No conversations yet. Start one with New.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {mergedRows.map((row) =>
                  row.kind === "team" ? (
                    <li key="team">
                      <button
                        type="button"
                        onClick={() => selectTeamChannel()}
                        className={cn(
                          "flex w-full gap-3 px-3 py-3 text-left transition hover:bg-slate-50",
                          isTeamThread && "bg-accent-tint/50",
                        )}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
                          <Users className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            Team · {row.title}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                            {row.preview
                              ? row.preview
                              : "Message everyone in this workspace"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li key={String(row.conversationId)}>
                      <button
                        type="button"
                        onClick={() => selectConversation(row.conversationId)}
                        className={cn(
                          "flex w-full gap-3 px-3 py-3 text-left transition hover:bg-slate-50",
                          !isTeamThread &&
                            conversationId === row.conversationId &&
                            "bg-accent-tint/50",
                        )}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                          {row.otherName.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {row.otherName}
                          </span>
                          {row.preview ? (
                            <span className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                              {row.preview}
                            </span>
                          ) : (
                            <span className="mt-0.5 text-[11px] text-slate-400">
                              No messages yet
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </aside>

        <section
          className={cn(
            "flex min-h-[min(50vh,480px)] min-w-0 flex-1 flex-col bg-slate-50/50",
            !activeThread && "max-lg:hidden",
          )}
        >
          {!activeThread ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
                <Mail className="h-10 w-10 text-slate-400" />
              </div>
              <p className="max-w-xs text-sm text-slate-600">
                Select a conversation, the team channel, or start a new message.
              </p>
            </div>
          ) : threadLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
          ) : isTeamThread ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => clearThread()}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
                  <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    Team · {workspaceName ?? "Workspace"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Everyone in this workspace sees these messages
                  </p>
                </div>
              </div>

              <div
                className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5"
                role="log"
                aria-live="polite"
              >
                {!teamThread || teamThread.length === 0 ? (
                  <p className="text-center text-xs text-slate-500">
                    No messages yet. Say something below — everyone in the
                    workspace will see it.
                  </p>
                ) : (
                  teamThread.map((m, i) => {
                    const prev = i > 0 ? teamThread[i - 1] : null;
                    const showDay =
                      !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                    const isOwn =
                      viewerId !== undefined && m.senderId === viewerId;
                    return (
                      <div key={String(m._id)}>
                        {showDay ? (
                          <div className="my-4 flex justify-center first:mt-0">
                            <span className="rounded-full bg-slate-200/80 px-3 py-1 text-[11px] font-medium text-slate-600">
                              {formatShortDate(m.createdAt)}
                            </span>
                          </div>
                        ) : null}
                        <div
                          className={cn(
                            "flex w-full",
                            isOwn ? "justify-end" : "justify-start",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                              isOwn
                                ? "rounded-br-md bg-[color:var(--kruvan-brand)] text-white"
                                : "rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200/90",
                            )}
                          >
                            {!isOwn ? (
                              <p className="mb-1 text-[11px] font-semibold text-accent-ink">
                                {m.senderName}
                              </p>
                            ) : null}
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {m.body}
                            </p>
                            <p
                              className={cn(
                                "mt-1.5 text-[10px] tabular-nums",
                                isOwn ? "text-white/75" : "text-slate-400",
                              )}
                            >
                              {formatTime(m.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div
                  ref={bottomRef}
                  className="h-px w-full shrink-0"
                  aria-hidden
                />
              </div>

              <form
                onSubmit={(e) => void onSubmit(e)}
                className="border-t border-slate-200/80 bg-white p-3 sm:p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label htmlFor="team-msg-input" className="sr-only">
                    Message
                  </label>
                  <textarea
                    id="team-msg-input"
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Message everyone in this workspace…"
                    disabled={sending}
                    className="min-h-[2.75rem] flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 input-focus-accent disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40 sm:h-[2.75rem] sm:self-stretch"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Send
                      </>
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : header === null ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-sm text-slate-600">Conversation not found.</p>
              <button
                type="button"
                onClick={() => clearThread()}
                className="text-xs font-semibold text-accent-ink"
              >
                Back to list
              </button>
            </div>
          ) : header ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => clearThread()}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                  {header.otherName.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {header.otherName}
                  </p>
                  <p className="text-[11px] text-slate-500">Direct message</p>
                </div>
              </div>

              <div
                className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5"
                role="log"
                aria-live="polite"
              >
                {!thread || thread.length === 0 ? (
                  <p className="text-center text-xs text-slate-500">
                    No messages yet. Say hello below.
                  </p>
                ) : (
                  thread.map((m, i) => {
                    const prev = i > 0 ? thread[i - 1] : null;
                    const showDay =
                      !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                    const isOwn =
                      viewerId !== undefined && m.senderId === viewerId;
                    return (
                      <div key={String(m._id)}>
                        {showDay ? (
                          <div className="my-4 flex justify-center first:mt-0">
                            <span className="rounded-full bg-slate-200/80 px-3 py-1 text-[11px] font-medium text-slate-600">
                              {formatShortDate(m.createdAt)}
                            </span>
                          </div>
                        ) : null}
                        <div
                          className={cn(
                            "flex w-full",
                            isOwn ? "justify-end" : "justify-start",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                              isOwn
                                ? "rounded-br-md bg-[color:var(--kruvan-brand)] text-white"
                                : "rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200/90",
                            )}
                          >
                            {!isOwn ? (
                              <p className="mb-1 text-[11px] font-semibold text-accent-ink">
                                {m.senderName}
                              </p>
                            ) : null}
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {m.body}
                            </p>
                            <p
                              className={cn(
                                "mt-1.5 text-[10px] tabular-nums",
                                isOwn ? "text-white/75" : "text-slate-400",
                              )}
                            >
                              {formatTime(m.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div
                  ref={bottomRef}
                  className="h-px w-full shrink-0"
                  aria-hidden
                />
              </div>

              <form
                onSubmit={(e) => void onSubmit(e)}
                className="border-t border-slate-200/80 bg-white p-3 sm:p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label htmlFor="dm-input" className="sr-only">
                    Message
                  </label>
                  <textarea
                    id="dm-input"
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Message…"
                    disabled={sending}
                    className="min-h-[2.75rem] flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 input-focus-accent disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40 sm:h-[2.75rem] sm:self-stretch"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Send
                      </>
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </section>
      </div>

      <NewDmModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onStarted={(id) => {
          void navigate({
            to: "/messages",
            search: { conversation: String(id), team: undefined },
          });
        }}
      />
    </div>
  );
}
