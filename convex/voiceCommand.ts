/**
 * Voice command parsing via Google Gemini. Reuses `GEMINI_API_KEY` (see contentAi.ts).
 */
declare const process: { env: Record<string, string | undefined> };

import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_TRANSCRIPT = 4000;

const TASK_STATUSES = new Set([
  "todo",
  "in_progress",
  "done",
  "cancelled",
]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

type VoiceSnapshot = {
  projects: Array<{ id: Id<"projects">; name: string }>;
  folders: Array<{ id: Id<"folders">; name: string }>;
  tags: Array<{ id: Id<"tags">; name: string }>;
  members: Array<{ id: Id<"workspaceMembers">; name: string }>;
};

function formatGeminiHttpError(status: number, apiMessage: string): string {
  const m = apiMessage.toLowerCase();
  if (
    m.includes("quota") ||
    m.includes("resource_exhausted") ||
    m.includes("billing") ||
    m.includes("exceeded")
  ) {
    const hint =
      m.includes("limit: 0") || m.includes("free_tier")
        ? " Tip: zet in Google Cloud / AI Studio billing aan of wacht tot je quotum vernieuwt."
        : "";
    return (
      "Gemini-limiet of tegoed bereikt. Controleer quota in Google AI Studio." +
      hint +
      " (" +
      apiMessage +
      ")"
    );
  }
  if (
    status === 429 ||
    m.includes("rate limit") ||
    m.includes("rate_limit") ||
    m.includes("too many requests")
  ) {
    return "Te veel Gemini-verzoeken. Probeer het over een paar minuten opnieuw. (" + apiMessage + ")";
  }
  if (m.includes("not found") || m.includes("not supported for generatecontent")) {
    return (
      "Dit Gemini-model is niet beschikbaar. Model in code: " +
      GEMINI_MODEL +
      ". (" +
      apiMessage +
      ")"
    );
  }
  if (
    m.includes("api key") ||
    m.includes("permission") ||
    m.includes("invalid") ||
    status === 401 ||
    status === 403
  ) {
    return (
      "Ongeldige of ontbrekende Gemini API-key. Controleer GEMINI_API_KEY in Convex. (" +
      apiMessage +
      ")"
    );
  }
  return apiMessage;
}

function extractGeminiText(data: {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}): string {
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error("Geen antwoord van Gemini (geen candidates).");
  }
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(
      `Gemini stopte vroeg (${candidate.finishReason}). Probeer andere invoer.`,
    );
  }
  const parts = candidate.content?.parts;
  const text = parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("Leeg antwoord van Gemini.");
  }
  return text;
}

function parseDueDateYmd(s: string | null | undefined): {
  ts: number | null;
  warning?: string;
} {
  if (!s?.trim()) return { ts: null };
  const raw = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) {
    return { ts: null, warning: `Could not parse due date "${raw}".` };
  }
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`).getTime();
  if (Number.isNaN(t)) {
    return { ts: null, warning: `Invalid due date "${raw}".` };
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    return { ts: null, warning: `Invalid due date "${raw}".` };
  }
  return { ts: t };
}

function normalizeDatetimeLocal(
  s: string | null | undefined,
  fieldLabel: string,
): { value: string | null; warning?: string } {
  if (!s?.trim()) return { value: null };
  const raw = s.trim();
  let t = raw;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) {
    t = `${t}:00`;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(t)) {
    return {
      value: null,
      warning: `Invalid ${fieldLabel} datetime (use YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss).`,
    };
  }
  const ms = new Date(t).getTime();
  if (Number.isNaN(ms)) {
    return { value: null, warning: `Invalid ${fieldLabel} datetime.` };
  }
  return { value: t };
}

function matchByName<T extends { id: unknown; name: string }>(
  rows: T[],
  spoken: string | null | undefined,
  label: string,
): { id: T["id"] | null; warnings: string[] } {
  const warnings: string[] = [];
  if (!spoken?.trim()) return { id: null, warnings };
  const needle = spoken.trim().toLowerCase();
  const exact = rows.filter((r) => r.name.trim().toLowerCase() === needle);
  if (exact.length === 1) return { id: exact[0]!.id, warnings };
  const partial = rows.filter((r) => {
    const pn = r.name.trim().toLowerCase();
    return pn.includes(needle) || (needle.length >= 2 && needle.includes(pn));
  });
  if (partial.length === 1) return { id: partial[0]!.id, warnings };
  if (partial.length > 1) {
    warnings.push(`Multiple ${label} match "${spoken.trim()}". Choose below.`);
    return { id: null, warnings };
  }
  warnings.push(`No ${label} matched "${spoken.trim()}".`);
  return { id: null, warnings };
}

function matchTagsByNames(
  tags: Array<{ id: Id<"tags">; name: string }>,
  names: unknown,
): { labelIds: Id<"tags">[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!Array.isArray(names) || names.length === 0) {
    return { labelIds: [], warnings };
  }
  const out: Id<"tags">[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) continue;
    const { id, warnings: w } = matchByName(tags, name, "tags");
    warnings.push(...w);
    if (id && !seen.has(String(id))) {
      seen.add(String(id));
      out.push(id as Id<"tags">);
    }
  }
  return { labelIds: out, warnings };
}

function parseStatus(
  s: string | null | undefined,
): "todo" | "in_progress" | "done" | "cancelled" | null {
  if (!s?.trim()) return null;
  const x = s.trim().toLowerCase().replace(/\s+/g, "_");
  if (x === "to_do" || x === "todo") return "todo";
  if (x === "in_progress" || x === "inprogress" || x === "doing") {
    return "in_progress";
  }
  if (x === "done" || x === "completed") return "done";
  if (x === "cancelled" || x === "canceled") return "cancelled";
  if (TASK_STATUSES.has(x)) return x as "todo" | "in_progress" | "done" | "cancelled";
  return null;
}

function parsePriority(
  s: string | null | undefined,
): "low" | "medium" | "high" | "urgent" | null {
  if (!s?.trim()) return null;
  const x = s.trim().toLowerCase();
  if (PRIORITIES.has(x)) return x as "low" | "medium" | "high" | "urgent";
  return null;
}

function parseSubtasks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim().slice(0, 500));
    }
  }
  return out.slice(0, 40);
}

type ParsedIntent = {
  kind: "task" | "note" | "event";
  title: string;
  body: string;
  dueDate: string | null;
  projectName: string | null;
  folderName: string | null;
  status: string | null;
  priority: string | null;
  subtasks: string[];
  assigneeName: string | null;
  agendaStartLocal: string | null;
  agendaEndLocal: string | null;
  eventStartLocal: string | null;
  eventEndLocal: string | null;
  tagNames: string[];
};

function parseVoiceIntentJson(text: string): ParsedIntent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim()) as unknown;
  } catch {
    throw new Error("Could not parse AI response as JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid AI response shape.");
  }
  const o = parsed as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== "task" && kind !== "note" && kind !== "event") {
    throw new Error('AI response must use kind "task", "note", or "event".');
  }
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!title) {
    throw new Error("AI response missing title.");
  }
  const body =
    typeof o.body === "string"
      ? o.body.trim()
      : o.body == null
        ? ""
        : String(o.body).trim();

  const dueDate =
    o.dueDate === null || o.dueDate === undefined
      ? null
      : typeof o.dueDate === "string"
        ? o.dueDate.trim()
        : null;

  const projectName =
    o.projectName === null || o.projectName === undefined
      ? null
      : typeof o.projectName === "string"
        ? o.projectName.trim()
        : null;

  const folderName =
    o.folderName === null || o.folderName === undefined
      ? null
      : typeof o.folderName === "string"
        ? o.folderName.trim()
        : null;

  return {
    kind,
    title: title.slice(0, 500),
    body: body.slice(0, 8000),
    dueDate,
    projectName: projectName ? projectName.slice(0, 200) : null,
    folderName: folderName ? folderName.slice(0, 200) : null,
    status: typeof o.status === "string" ? o.status : null,
    priority: typeof o.priority === "string" ? o.priority : null,
    subtasks: parseSubtasks(o.subtasks),
    assigneeName:
      o.assigneeName === null || o.assigneeName === undefined
        ? null
        : typeof o.assigneeName === "string"
          ? o.assigneeName.trim()
          : null,
    agendaStartLocal:
      typeof o.agendaStartLocal === "string" ? o.agendaStartLocal.trim() : null,
    agendaEndLocal:
      typeof o.agendaEndLocal === "string" ? o.agendaEndLocal.trim() : null,
    eventStartLocal:
      typeof o.eventStartLocal === "string" ? o.eventStartLocal.trim() : null,
    eventEndLocal:
      typeof o.eventEndLocal === "string" ? o.eventEndLocal.trim() : null,
    tagNames: Array.isArray(o.tagNames)
      ? o.tagNames.filter((x): x is string => typeof x === "string")
      : [],
  };
}

export const parseVoiceCommand = action({
  args: {
    workspaceId: v.id("workspaces"),
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated.");
    }

    const trimmed = args.transcript.trim().slice(0, MAX_TRANSCRIPT);
    if (!trimmed) {
      throw new Error("Transcript is empty.");
    }

    const snapshot = (await ctx.runQuery(
      api.voiceCommandQueries.workspaceSnapshotForVoice,
      { workspaceId: args.workspaceId },
    )) as VoiceSnapshot;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error(
        "Gemini is niet geconfigureerd. Zet GEMINI_API_KEY voor deze deployment (Convex dashboard → Environment Variables), of: npx convex env set GEMINI_API_KEY '…' — key: https://aistudio.google.com/apikey",
      );
    }

    const projectBlock =
      snapshot.projects.length === 0
        ? "(No projects.)"
        : snapshot.projects.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
    const folderBlock =
      snapshot.folders.length === 0
        ? "(No folders.)"
        : snapshot.folders.map((f, i) => `${i + 1}. ${f.name}`).join("\n");
    const tagBlock =
      snapshot.tags.length === 0
        ? "(No tags.)"
        : snapshot.tags.map((t, i) => `${i + 1}. ${t.name}`).join("\n");
    const memberBlock =
      snapshot.members.length === 0
        ? "(No members.)"
        : snapshot.members.map((m, i) => `${i + 1}. ${m.name}`).join("\n");

    const userPrompt = `The user spoke in Dutch or English. Decide if they want to create a TASK, a NOTE, or a CALENDAR EVENT (agenda).

Transcript:
"""
${trimmed}
"""

Projects:
${projectBlock}

Folders (for notes):
${folderBlock}

Tags (labels for tasks):
${tagBlock}

Workspace members (assignee for tasks):
${memberBlock}

Return ONLY valid JSON with this shape (no markdown):
{
  "kind": "task" | "note" | "event",
  "title": "string",
  "body": "task: description; note: body text; event: optional description",
  "dueDate": "YYYY-MM-DD" | null,
  "projectName": "string" | null,
  "folderName": "string" | null,
  "status": "todo" | "in_progress" | "done" | "cancelled" | null,
  "priority": "low" | "medium" | "high" | "urgent" | null,
  "subtasks": ["step 1", "step 2"],
  "assigneeName": "string" | null,
  "agendaStartLocal": "YYYY-MM-DDTHH:mm:ss" | null,
  "agendaEndLocal": "YYYY-MM-DDTHH:mm:ss" | null,
  "eventStartLocal": "YYYY-MM-DDTHH:mm:ss" | null,
  "eventEndLocal": "YYYY-MM-DDTHH:mm:ss" | null,
  "tagNames": ["tag a", "tag b"]
}

Rules:
- kind "task": todos, reminders, deadlines, action items.
- kind "note": information to store, journals, text without a clear calendar action.
- kind "event": meetings, appointments, blocks on the agenda — use eventStartLocal and eventEndLocal (local wall time, no timezone suffix).
- dueDate: only for tasks when a day is mentioned.
- agendaStartLocal / agendaEndLocal: optional task calendar block; both or neither; local wall time.
- Datetimes: use format YYYY-MM-DDTHH:mm:ss (local intent, no Z suffix).
- subtasks: short checklist items for tasks; empty array if none.
- tagNames: only tags that exist in the list; empty array if none.
- Output JSON only.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You reply only with a single JSON object matching the user's requested schema.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
        },
      }),
    });

    const raw = await res.text();
    let data: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      error?: { message?: string; code?: number; status?: string };
    };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      throw new Error(`Gemini response was not JSON (${res.status}).`);
    }

    if (!res.ok) {
      const msg =
        data.error?.message ??
        (raw.length < 400 ? raw : `HTTP ${res.status}`);
      throw new Error(formatGeminiHttpError(res.status, msg));
    }

    const content = extractGeminiText(data);
    const intent = parseVoiceIntentJson(content);

    const warnings: string[] = [];

    const { id: projectId, warnings: wp } = matchByName(
      snapshot.projects,
      intent.projectName,
      "projects",
    );
    warnings.push(...wp);

    const { id: folderId, warnings: wf } = matchByName(
      snapshot.folders,
      intent.folderName,
      "folders",
    );
    warnings.push(...wf);

    const { id: assigneeMemberId, warnings: wm } = matchByName(
      snapshot.members,
      intent.assigneeName,
      "members",
    );
    warnings.push(...wm);

    const { labelIds, warnings: wt } = matchTagsByNames(
      snapshot.tags,
      intent.tagNames,
    );
    warnings.push(...wt);

    let dueDate: number | null = null;
    if (intent.kind === "task" && intent.dueDate) {
      const { ts, warning } = parseDueDateYmd(intent.dueDate);
      dueDate = ts;
      if (warning) warnings.push(warning);
    }

    const status = parseStatus(intent.status);
    const priority = parsePriority(intent.priority);

    let schedStartLocal: string | null = null;
    let schedEndLocal: string | null = null;
    if (intent.kind === "task") {
      const a = normalizeDatetimeLocal(
        intent.agendaStartLocal,
        "Agenda start",
      );
      const b = normalizeDatetimeLocal(intent.agendaEndLocal, "Agenda end");
      if (a.warning) warnings.push(a.warning);
      if (b.warning) warnings.push(b.warning);
      if (a.value && b.value) {
        const ta = new Date(a.value).getTime();
        const tb = new Date(b.value).getTime();
        if (!Number.isNaN(ta) && !Number.isNaN(tb) && tb > ta) {
          schedStartLocal = a.value;
          schedEndLocal = b.value;
        } else if (a.value || b.value) {
          warnings.push("Agenda block needs valid start and end (end after start).");
        }
      }
    }

    let eventStartLocal: string | null = null;
    let eventEndLocal: string | null = null;
    if (intent.kind === "event") {
      const a = normalizeDatetimeLocal(intent.eventStartLocal, "Event start");
      const b = normalizeDatetimeLocal(intent.eventEndLocal, "Event end");
      if (a.warning) warnings.push(a.warning);
      if (b.warning) warnings.push(b.warning);
      if (a.value && b.value) {
        const ta = new Date(a.value).getTime();
        const tb = new Date(b.value).getTime();
        if (!Number.isNaN(ta) && !Number.isNaN(tb) && tb > ta) {
          eventStartLocal = a.value;
          eventEndLocal = b.value;
        } else if (a.value || b.value) {
          warnings.push("Event needs valid start and end (end after start).");
        }
      }
    }

    return {
      kind: intent.kind,
      title: intent.title,
      body: intent.body,
      dueDate,
      projectId: projectId as Id<"projects"> | null,
      folderId: folderId as Id<"folders"> | null,
      warnings,
      status,
      priority,
      subtaskTitles: intent.subtasks,
      assigneeMemberId: assigneeMemberId as Id<"workspaceMembers"> | null,
      schedStartLocal,
      schedEndLocal,
      labelIds,
      eventStartLocal,
      eventEndLocal,
    };
  },
});
