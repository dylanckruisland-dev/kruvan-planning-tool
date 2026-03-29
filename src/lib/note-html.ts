import DOMPurify from "dompurify";

/** Safe subset for rich note bodies (bold, color, size, lists, etc.). */
export const NOTE_SANITIZE = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "div",
    "span",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "s",
    "strike",
    "font",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "blockquote",
    "hr",
    "pre",
    "code",
  ],
  ALLOWED_ATTR: ["style", "class", "color", "face", "size"],
} satisfies Parameters<typeof DOMPurify.sanitize>[1];

export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, NOTE_SANITIZE);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain notes (no HTML) become a single paragraph; HTML passes through. */
export function bodyToHtmlForEditor(body: string): string {
  const t = body.trim();
  if (!t) return "<p><br></p>";
  if (t.startsWith("<")) return body;
  return `<p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>`;
}

export function htmlToPlainText(html: string): string {
  if (!html.includes("<")) return html.replace(/\s+/g, " ").trim();
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
