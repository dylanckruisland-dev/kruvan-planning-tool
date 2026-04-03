import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { normalizeWorkspaceAccent } from "@/lib/workspace-accent";
import { WorkspaceCollaborationSection } from "@/components/settings/WorkspaceCollaborationSection";
import { IcsCalendarSection } from "@/components/settings/IcsCalendarSection";
import { useTabTitle } from "@/hooks/useTabTitle";

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
  { value: "/messages", label: "Messages" },
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
  useTabTitle("Settings");
  const { workspaceId, workspace } = useWorkspace();
  const updateWorkspace = useMutation(api.workspaces.update);

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
    {
      const route = workspace.defaultLandingRoute as string | undefined;
      setDefaultLandingRoute(
        route === "/chat" ? "/messages" : (route ?? "/"),
      );
    }
    setTimezone(workspace.timezone?.trim() ?? "");
    setTimeFormat(
      workspace.timeFormat === "12" || workspace.timeFormat === "24"
        ? workspace.timeFormat
        : "",
    );
    setWeekStartsOn(
      workspace.weekStartsOn === "sunday" ? "sunday" : "monday",
    );
  }, [workspace]);

  const tzList = useMemo(() => timeZoneOptions(), []);

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
        description="Workspace preferences, collaboration, and defaults."
      />

      <WorkspaceCollaborationSection workspaceId={workspaceId} />

      <IcsCalendarSection workspaceId={workspaceId} />

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
    </div>
  );
}
