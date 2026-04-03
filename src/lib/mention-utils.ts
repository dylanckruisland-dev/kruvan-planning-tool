export type MentionKind =
  | "task"
  | "note"
  | "project"
  | "event"
  | "assignee"
  | "content";

export type MentionItem = {
  kind: MentionKind;
  id: string;
  label: string;
  sublabel?: string;
};

/** Strip characters that break markdown-style mention tokens. */
export function sanitizeMentionLabel(label: string): string {
  return label.replace(/\]/g, "").replace(/\n/g, " ").trim() || "item";
}

/** Inserted token: visible label + machine-readable ref (parseable later). */
export function buildMentionToken(item: MentionItem): string {
  const label = sanitizeMentionLabel(item.label);
  return `@[${label}](mention:${item.kind}:${item.id})`;
}

export type ActiveMentionRange = {
  start: number;
  end: number;
  query: string;
};

/**
 * If the cursor is immediately after `@` with an optional query (no spaces),
 * returns the range to replace and the query string for filtering.
 */
export function getActiveMention(
  value: string,
  cursorPos: number,
): ActiveMentionRange | null {
  const before = value.slice(0, cursorPos);
  const lastAt = before.lastIndexOf("@");
  if (lastAt === -1) return null;
  const afterAt = before.slice(lastAt + 1);
  if (/[\s\n]/.test(afterAt)) return null;
  if (lastAt > 0) {
    const prev = value[lastAt - 1];
    if (prev && !/\s/.test(prev)) return null;
  }
  return {
    start: lastAt,
    end: cursorPos,
    query: afterAt,
  };
}

export function insertMentionAtRange(
  value: string,
  range: ActiveMentionRange,
  item: MentionItem,
): string {
  const token = buildMentionToken(item);
  return value.slice(0, range.start) + token + value.slice(range.end);
}

export function caretAfterMention(range: ActiveMentionRange, item: MentionItem): number {
  return range.start + buildMentionToken(item).length;
}

/** Parsed segment: plain text or a stored mention token. */
export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; label: string; kind: MentionKind; id: string };

const MENTION_TOKEN_RE =
  /@\[([^\]]*)\]\(mention:(task|note|project|event|assignee|content):([^)]+)\)/g;

/**
 * Split `text` into plain runs and mention runs matching `buildMentionToken` format.
 */
export function parseTextWithMentions(text: string): MentionSegment[] {
  if (!text) return [{ type: "text", value: "" }];
  const segments: MentionSegment[] = [];
  let last = 0;
  const re = new RegExp(MENTION_TOKEN_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ type: "text", value: text.slice(last, m.index) });
    }
    segments.push({
      type: "mention",
      label: (m[1] ?? "").trim() || "item",
      kind: m[2] as MentionKind,
      id: m[3] ?? "",
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  if (segments.length === 0) {
    segments.push({ type: "text", value: text });
  }
  return segments;
}
