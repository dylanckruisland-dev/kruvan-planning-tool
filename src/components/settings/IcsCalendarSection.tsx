import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { RefreshCw, Trash2 } from "lucide-react";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

type Props = {
  workspaceId: Id<"workspaces">;
};

export function IcsCalendarSection({ workspaceId }: Props) {
  const subs = useQuery(api.icsCalendar.listSubscriptions, { workspaceId });
  const upsert = useMutation(api.icsCalendar.upsertSubscription);
  const remove = useMutation(api.icsCalendar.removeSubscription);
  const triggerSync = useMutation(api.icsCalendar.triggerSync);

  const [name, setName] = useState("Outlook");
  const [icsUrl, setIcsUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<Id<"icsCalendarSubscriptions"> | null>(
    null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = icsUrl.trim();
    if (!url) return;
    setBusy(true);
    try {
      await upsert({
        workspaceId,
        subscriptionId: editingId ?? undefined,
        name: name.trim() || "Calendar",
        icsUrl: url,
        enabled: true,
      });
      setIcsUrl("");
      setEditingId(null);
      setName("Outlook");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(id: Id<"icsCalendarSubscriptions">) {
    const s = subs?.find((x) => x._id === id);
    if (!s) return;
    setEditingId(id);
    setName(s.name);
    setIcsUrl(s.icsUrl);
  }

  function cancelEdit() {
    setEditingId(null);
    setIcsUrl("");
    setName("Outlook");
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">
        External calendars (ICS)
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Paste a read-only calendar link from Outlook (or another app). Kruvan
        refreshes it about every 15 minutes — not instant, but no Microsoft login
        required.
      </p>
      <p className="mt-2 text-[11px] text-slate-400">
        Outlook: Settings → Calendar → Shared calendars → Publish a calendar →
        copy the ICS link (you can use the link as-is or the{" "}
        <code className="rounded bg-slate-100 px-1">webcal://</code> URL).
      </p>
      <p className="mt-1 text-[11px] text-slate-400">
        iCloud: use the <strong className="font-medium">published</strong> link
        from iCloud.com → Calendar → share → Public (URL contains{" "}
        <code className="rounded bg-slate-100 px-1">caldav.icloud.com/published</code>
        ). Paste the full URL — if sync fails, check the message next to “Last
        synced”.
      </p>

      {subs === undefined ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : subs.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {subs.map((s) => (
            <li
              key={s._id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {s.name}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                  {s.icsUrl}
                </p>
                <dl className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <dt className="font-medium text-slate-600">Last import OK</dt>
                    <dd>
                      {s.lastSyncedAt
                        ? new Date(s.lastSyncedAt).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <dt className="font-medium text-slate-600">Last attempt</dt>
                    <dd>
                      {s.lastAttemptAt
                        ? new Date(s.lastAttemptAt).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                  {s.lastError ? (
                    <div className="pt-0.5 text-amber-800">
                      <span className="font-medium text-amber-900">
                        Last error:{" "}
                      </span>
                      {s.lastError}
                    </div>
                  ) : null}
                </dl>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void triggerSync({ subscriptionId: s._id })}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync now
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(s._id)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void remove({ subscriptionId: s._id })}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
        <div>
          <label htmlFor="ics-name" className="text-xs text-slate-500">
            Label
          </label>
          <input
            id="ics-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Outlook"
          />
        </div>
        <div>
          <label htmlFor="ics-url" className="text-xs text-slate-500">
            ICS URL
          </label>
          <input
            id="ics-url"
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            className={inputClass}
            placeholder="https://outlook.office365.com/owa/calendar/..."
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy || !icsUrl.trim()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
          >
            {busy
              ? "Saving…"
              : editingId
                ? "Update calendar"
                : subs?.length
                  ? "Add another"
                  : "Connect calendar"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
