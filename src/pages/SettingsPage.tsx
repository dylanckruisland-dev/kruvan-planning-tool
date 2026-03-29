import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Id } from "@cvx/_generated/dataModel";
import { Trash2 } from "lucide-react";
import { normalizeWorkspaceAccent } from "@/lib/workspace-accent";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

const selectClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

const LANDING_OPTIONS = [
  { value: "/", label: "Overview" },
  { value: "/agenda", label: "Agenda" },
  { value: "/tasks", label: "Tasks" },
  { value: "/notes", label: "Notes" },
  { value: "/content", label: "Content" },
  { value: "/projects", label: "Projects" },
  { value: "/settings", label: "Settings" },
] as const;

function timeZoneOptions(): string[] {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* ignore */
  }
  return ["UTC", "Europe/Amsterdam", "America/New_York"];
}

export function SettingsPage() {
  const { workspaceId, workspace } = useWorkspace();
  const members = useQuery(
    api.workspaceMembers.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );
  const createMember = useMutation(api.workspaceMembers.create);
  const removeMember = useMutation(api.workspaceMembers.remove);
  const updateWorkspace = useMutation(api.workspaces.update);

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<Id<"workspaceMembers"> | null>(
    null,
  );

  const [wsName, setWsName] = useState("");
  const [accent, setAccent] = useState("#4f46e5");
  const [defaultAgendaView, setDefaultAgendaView] = useState<"week" | "day">(
    "week",
  );
  const [defaultTaskView, setDefaultTaskView] = useState<"list" | "board">(
    "list",
  );
  const [defaultLandingRoute, setDefaultLandingRoute] = useState<string>("/");
  const [timezone, setTimezone] = useState("");
  const [timeFormat, setTimeFormat] = useState<"" | "12" | "24">("");
  const [weekStartsOn, setWeekStartsOn] = useState<"sunday" | "monday">(
    "monday",
  );
  const [profileBusy, setProfileBusy] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    setWsName(workspace.name);
    setAccent(normalizeWorkspaceAccent(workspace.accent));
    setDefaultAgendaView(
      workspace.defaultAgendaView === "day" ? "day" : "week",
    );
    setDefaultTaskView(
      workspace.defaultTaskView === "board" ? "board" : "list",
    );
    setDefaultLandingRoute(workspace.defaultLandingRoute ?? "/");
    setTimezone(workspace.timezone?.trim() ?? "");
    setTimeFormat(
      workspace.timeFormat === "12" || workspace.timeFormat === "24"
        ? workspace.timeFormat
        : "",
    );
    setWeekStartsOn(
      workspace.weekStartsOn === "sunday" ? "sunday" : "monday",
    );
  }, [workspace?._id]);

  const sorted = useMemo(() => {
    const list = members ?? [];
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [members]);

  const tzList = useMemo(() => timeZoneOptions(), []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !memberName.trim()) return;
    setBusy(true);
    try {
      await createMember({
        workspaceId,
        name: memberName.trim(),
        email: memberEmail.trim() || undefined,
      });
      setMemberName("");
      setMemberEmail("");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: Id<"workspaceMembers">) {
    setRemovingId(id);
    try {
      await removeMember({ memberId: id });
    } finally {
      setRemovingId(null);
    }
  }

  async function saveWorkspaceProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !wsName.trim()) return;
    setProfileBusy(true);
    try {
      await updateWorkspace({
        workspaceId,
        name: wsName.trim(),
        accent: accent.trim() || null,
        defaultAgendaView,
        defaultTaskView,
        defaultLandingRoute: LANDING_OPTIONS.some(
          (o) => o.value === defaultLandingRoute,
        )
          ? (defaultLandingRoute as (typeof LANDING_OPTIONS)[number]["value"])
          : "/",
        timezone: timezone.trim() || null,
        timeFormat: timeFormat === "" ? null : timeFormat,
        weekStartsOn,
      });
    } finally {
      setProfileBusy(false);
    }
  }

  if (!workspaceId) {
    return (
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Settings"
        description="Workspace preferences, defaults, and who can be assigned to tasks."
      />

      <form
        onSubmit={(e) => void saveWorkspaceProfile(e)}
        className="space-y-6"
      >
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Workspace profile
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Name and accent color for this workspace.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label htmlFor="ws-name" className="text-xs text-slate-500">
                Name
              </label>
              <input
                id="ws-name"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div className="flex items-end gap-3">
              <div>
                <label htmlFor="ws-accent" className="text-xs text-slate-500">
                  Accent
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="ws-accent"
                    type="color"
                    value={normalizeWorkspaceAccent(accent)}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    placeholder="#4f46e5"
                    className={`${inputClass} mt-0 font-mono text-xs`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Default view
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Defaults when opening Agenda and Tasks, and which page opens first
            after the app loads.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-slate-500">Agenda</label>
              <select
                className={selectClass}
                value={defaultAgendaView}
                onChange={(e) =>
                  setDefaultAgendaView(
                    e.target.value === "day" ? "day" : "week",
                  )
                }
              >
                <option value="week">Week</option>
                <option value="day">Day</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Tasks</label>
              <select
                className={selectClass}
                value={defaultTaskView}
                onChange={(e) =>
                  setDefaultTaskView(
                    e.target.value === "board" ? "board" : "list",
                  )
                }
              >
                <option value="list">List (by status)</option>
                <option value="board">Board</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">
                First page (after opening app)
              </label>
              <select
                className={selectClass}
                value={defaultLandingRoute}
                onChange={(e) => setDefaultLandingRoute(e.target.value)}
              >
                {LANDING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            The landing page only applies the first time you go to Overview in
            this session; after that, Overview stays available from the menu.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Time &amp; region
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Times and dates in the app; the week starts on Sunday or Monday in
            the calendar.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="text-xs text-slate-500">Time zone</label>
              <select
                className={selectClass}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="">Browser / system (default)</option>
                {tzList.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Time format</label>
              <select
                className={selectClass}
                value={timeFormat}
                onChange={(e) =>
                  setTimeFormat(
                    e.target.value === "12" || e.target.value === "24"
                      ? e.target.value
                      : "",
                  )
                }
              >
                <option value="">Browser (default)</option>
                <option value="24">24-hour</option>
                <option value="12">12-hour (a.m. / p.m.)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Week start</label>
              <select
                className={selectClass}
                value={weekStartsOn}
                onChange={(e) =>
                  setWeekStartsOn(
                    e.target.value === "sunday" ? "sunday" : "monday",
                  )
                }
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={profileBusy || !wsName.trim()}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
          >
            {profileBusy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Task assignees
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Names you add here appear in the assignee menu on tasks across this
          workspace. Removing someone clears them from any tasks they were
          assigned to.
        </p>

        {members === undefined ? (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" />
        ) : sorted.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No assignees yet. Add a name below to get started.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {sorted.map((m) => (
              <li
                key={String(m._id)}
                className="flex items-center justify-between gap-3 px-3 py-2.5 first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {m.name}
                  </p>
                  {m.email ? (
                    <p className="truncate text-xs text-slate-500">{m.email}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemove(m._id)}
                  disabled={removingId === m._id}
                  className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  aria-label={`Remove ${m.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={(e) => void handleAdd(e)} className="mt-6 space-y-3">
          <p className="text-xs font-medium text-slate-600">Add assignee</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="member-name" className="text-xs text-slate-500">
                Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="member-name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="e.g. Alex Kim"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="member-email" className="text-xs text-slate-500">
                Email (optional)
              </label>
              <input
                id="member-email"
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="alex@…"
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || !workspaceId || !memberName.trim()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
            >
              Add assignee
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
