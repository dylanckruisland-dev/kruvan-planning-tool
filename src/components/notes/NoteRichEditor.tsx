import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Bold,
  Italic,
  Palette,
  Underline,
} from "lucide-react";
import {
  bodyToHtmlForEditor,
  sanitizeNoteHtml,
} from "@/lib/note-html";
import { cn } from "@/lib/cn";

type Props = {
  body: string;
  onSave: (html: string) => void;
  /** 0 = save on every change (e.g. local modal state). Default debounce for Convex. */
  debounceMs?: number;
  className?: string;
};

const FONT_SIZES: { label: string; value: string }[] = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "4" },
  { label: "Huge", value: "5" },
];

export function NoteRichEditor({
  body,
  onSave,
  debounceMs = 450,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const clean = sanitizeNoteHtml(el.innerHTML);
    if (clean !== el.innerHTML) {
      el.innerHTML = clean;
    }
    onSave(clean);
  }, [onSave]);

  const scheduleSave = useCallback(() => {
    if (debounceMs <= 0) {
      flushSave();
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      flushSave();
    }, debounceMs);
  }, [debounceMs, flushSave]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = bodyToHtmlForEditor(body);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when switching notes (parent uses key)
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  function runCommand(cmd: string, value?: string) {
    ref.current?.focus();
    try {
      document.execCommand(cmd, false, value);
    } catch {
      /* ignore */
    }
    scheduleSave();
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand("bold")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-slate-900"
          title="Bold"
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand("italic")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-slate-900"
          title="Italic"
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand("underline")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-slate-900"
          title="Underline"
          aria-label="Underline"
        >
          <Underline className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
        <label className="inline-flex items-center gap-1.5 pl-1">
          <span className="sr-only">Text size</span>
          <select
            className="h-8 max-w-[7.5rem] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none input-focus-accent"
            defaultValue="3"
            onChange={(e) => runCommand("fontSize", e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {FONT_SIZES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <span className="sr-only">Text color</span>
          <input
            type="color"
            className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
            defaultValue="#1e293b"
            onChange={(e) => runCommand("foreColor", e.target.value)}
            title="Text color"
          />
        </label>
      </div>
      <div
        ref={ref}
        className={cn(
          "min-h-[12rem] w-full flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none input-focus-accent",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
        )}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        onInput={scheduleSave}
        onBlur={flushSave}
      />
    </div>
  );
}
