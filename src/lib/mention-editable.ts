import {
  parseTextWithMentions,
  type MentionKind,
} from "@/lib/mention-utils";

const CHIP_CLASS =
  "mention-inline-chip inline rounded-md bg-[rgba(var(--kruvan-brand-rgb),0.12)] px-1 py-0.5 font-medium text-[color:var(--kruvan-brand)] ring-1 ring-[rgba(var(--kruvan-brand-rgb),0.2)]";

function tokenLength(
  kind: string,
  id: string | undefined,
  label: string | undefined,
): number {
  if (!id) return 0;
  return `@[${label ?? ""}](mention:${kind}:${id})`.length;
}

export function createMentionSpan(p: {
  kind: MentionKind;
  id: string;
  label: string;
}): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.mKind = p.kind;
  span.dataset.mId = p.id;
  span.dataset.mLabel = p.label;
  span.className = CHIP_CLASS;
  span.textContent = `@${p.label}`;
  return span;
}

/** Rebuild `el` from stored value (tokens + newlines). */
export function fillMentionEditable(el: HTMLElement, value: string): void {
  el.replaceChildren();
  const parts = parseTextWithMentions(value);
  for (const p of parts) {
    if (p.type === "mention") {
      el.appendChild(
        createMentionSpan({
          kind: p.kind,
          id: p.id,
          label: p.label,
        }),
      );
    } else {
      const chunks = p.value.split("\n");
      chunks.forEach((chunk, i) => {
        if (i > 0) el.appendChild(document.createElement("br"));
        if (chunk.length) el.appendChild(document.createTextNode(chunk));
      });
    }
  }
}

/** Serialize DOM back to stored `@[](mention:...)` string. */
export function serializeMentionEditable(el: HTMLElement): string {
  let s = "";
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      s += node.textContent ?? "";
    } else if (node instanceof HTMLElement) {
      if (node.dataset.mKind && node.dataset.mId) {
        const label = node.dataset.mLabel ?? "";
        s += `@[${label}](mention:${node.dataset.mKind}:${node.dataset.mId})`;
      } else if (node.tagName === "BR") {
        s += "\n";
      } else {
        for (const c of node.childNodes) walk(c);
      }
    }
  }
  for (const c of el.childNodes) walk(c);
  return s;
}

/** Caret position in serialized string (for @ detection). */
export function getSerializedCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  const end = range.endContainer;
  const endOff = range.endOffset;
  let offset = 0;
  let done = false;

  function walk(node: Node): void {
    if (done) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (node === end) {
        offset += Math.min(endOff, len);
        done = true;
        return;
      }
      offset += len;
      return;
    }
    if (node instanceof HTMLElement && node.dataset.mKind && node.dataset.mId) {
      const tl = tokenLength(
        node.dataset.mKind,
        node.dataset.mId,
        node.dataset.mLabel,
      );
      if (node === end) {
        offset += tl;
        done = true;
        return;
      }
      if (node.contains(end)) {
        offset += tl;
        done = true;
        return;
      }
      offset += tl;
      return;
    }
    if (node instanceof HTMLElement && node.tagName === "BR") {
      if (node === end) {
        offset += endOff === 0 ? 0 : 1;
        done = true;
        return;
      }
      offset += 1;
      return;
    }
    for (const c of node.childNodes) {
      walk(c);
      if (done) return;
    }
  }

  for (const c of el.childNodes) {
    walk(c);
    if (done) break;
  }
  return offset;
}

/** Place caret after `serializedOffset` characters in stored form. */
export function setSerializedCaretOffset(
  el: HTMLElement,
  serializedOffset: number,
): void {
  const sel = window.getSelection();
  if (!sel) return;
  const selection = sel;
  let remaining = serializedOffset;
  let found = false;

  function walk(node: Node): void {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (remaining <= len) {
        const r = document.createRange();
        r.setStart(node, Math.max(0, remaining));
        r.collapse(true);
        selection.removeAllRanges();
        selection.addRange(r);
        found = true;
        return;
      }
      remaining -= len;
      return;
    }
    if (node instanceof HTMLElement && node.dataset.mKind && node.dataset.mId) {
      const tl = tokenLength(
        node.dataset.mKind,
        node.dataset.mId,
        node.dataset.mLabel,
      );
      if (remaining <= tl) {
        const r = document.createRange();
        r.setStartAfter(node);
        r.collapse(true);
        selection.removeAllRanges();
        selection.addRange(r);
        found = true;
        return;
      }
      remaining -= tl;
      return;
    }
    if (node instanceof HTMLElement && node.tagName === "BR") {
      if (remaining <= 0) {
        const r = document.createRange();
        r.setStartBefore(node);
        r.collapse(true);
        selection.removeAllRanges();
        selection.addRange(r);
        found = true;
        return;
      }
      remaining -= 1;
      return;
    }
    for (const c of node.childNodes) {
      walk(c);
      if (found) return;
    }
  }

  for (const c of el.childNodes) {
    walk(c);
    if (found) break;
  }
  if (!found && el.childNodes.length === 0) {
    el.focus();
  }
}

export function insertTextAtCaret(text: string): void {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.setStartAfter(range.endContainer);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
