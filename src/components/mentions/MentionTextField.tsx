import { useQuery } from "convex/react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { cn } from "@/lib/cn";
import {
  fillMentionEditable,
  getSerializedCaretOffset,
  insertTextAtCaret,
  serializeMentionEditable,
  setSerializedCaretOffset,
} from "@/lib/mention-editable";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { mentionSectionHeader } from "@/lib/mention-sections";
import {
  caretAfterMention,
  getActiveMention,
  insertMentionAtRange,
  type ActiveMentionRange,
  type MentionItem,
} from "@/lib/mention-utils";

type BaseProps = {
  value: string;
  onValueChange: (value: string) => void;
  workspaceId: Id<"workspaces">;
  mentionEnabled?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
};

type InputProps = BaseProps &
  Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "onSelect" | "onKeyDown" | "ref"
  > & { multiline?: false };

type TextareaProps = BaseProps &
  Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "value" | "onChange" | "onSelect" | "onKeyDown" | "ref"
  > & { multiline: true };

type Props = InputProps | TextareaProps;

export function MentionTextField(props: Props) {
  const {
    multiline,
    value,
    onValueChange,
    workspaceId,
    mentionEnabled = true,
    className,
    onKeyDown: parentOnKeyDown,
    autoFocus,
    ...rest
  } = props;

  const ref = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const [active, setActive] = useState<ActiveMentionRange | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const debouncedQuery = useDebouncedValue(active?.query ?? "", 100);
  const results = useQuery(
    api.mentions.search,
    mentionEnabled && workspaceId && active !== null && !dismissed
      ? { workspaceId, query: debouncedQuery, perTypeLimit: 8 }
      : "skip",
  );

  const groups = useMemo(() => results?.groups ?? [], [results]);

  const items = useMemo((): MentionItem[] => {
    if (!groups.length) return [];
    return groups.flatMap((g) =>
      g.items.map((r) => ({
        kind: r.kind as MentionItem["kind"],
        id: r.id,
        label: r.label,
        sublabel: r.sublabel,
      })),
    );
  }, [groups]);

  const showDropdown =
    mentionEnabled &&
    active !== null &&
    !dismissed &&
    results !== undefined;

  const syncFromDom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const s = serializeMentionEditable(el);
    lastEmittedRef.current = s;
    onValueChange(s);
    const care = getSerializedCaretOffset(el);
    setActive(getActiveMention(s, care));
  }, [onValueChange]);

  const updateAnchor = useCallback(() => {
    const el = ref.current;
    if (el) setAnchor(el.getBoundingClientRect());
  }, []);

  useLayoutEffect(() => {
    if (!showDropdown) return;
    updateAnchor();
  }, [showDropdown, updateAnchor, value, active]);

  useEffect(() => {
    if (!showDropdown) return;
    updateAnchor();
    window.addEventListener("scroll", updateAnchor, true);
    window.addEventListener("resize", updateAnchor);
    return () => {
      window.removeEventListener("scroll", updateAnchor, true);
      window.removeEventListener("resize", updateAnchor);
    };
  }, [showDropdown, updateAnchor, value]);

  const didMountFill = useRef(false);

  /** First paint + external value changes — show chips, not raw tokens. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!didMountFill.current) {
      didMountFill.current = true;
      fillMentionEditable(el, value);
      lastEmittedRef.current = value;
      return;
    }
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    fillMentionEditable(el, value);
    setSerializedCaretOffset(el, value.length);
  }, [value]);

  useEffect(() => {
    setHighlight(0);
  }, [items.length, active?.start, active?.query]);

  const applyMention = useCallback(
    (item: MentionItem) => {
      if (!active) return;
      const el = ref.current;
      const current = el ? serializeMentionEditable(el) : value;
      const next = insertMentionAtRange(current, active, item);
      lastEmittedRef.current = next;
      onValueChange(next);
      const pos = caretAfterMention(active, item);
      setDismissed(false);
      setActive(null);
      setHighlight(0);
      requestAnimationFrame(() => {
        if (!ref.current) return;
        fillMentionEditable(ref.current, next);
        setSerializedCaretOffset(ref.current, pos);
        ref.current.focus();
      });
    },
    [active, onValueChange],
  );

  const handleInput = useCallback(() => {
    setDismissed(false);
    syncFromDom();
  }, [syncFromDom]);

  const handleSelectCapture = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const s = serializeMentionEditable(el);
    const care = getSerializedCaretOffset(el);
    setActive(getActiveMention(s, care));
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      insertTextAtCaret(text);
      syncFromDom();
    },
    [syncFromDom],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (showDropdown && items.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlight((h) => Math.min(h + 1, items.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlight((h) => Math.max(h - 1, 0));
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const item = items[highlight] ?? items[0];
          if (item) applyMention(item);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setDismissed(true);
          return;
        }
      } else if (showDropdown && items.length === 0 && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDismissed(true);
        return;
      }

      if (!multiline && e.key === "Enter") {
        e.preventDefault();
        return;
      }

      if (multiline && e.key === "Enter") {
        e.preventDefault();
        insertTextAtCaret("\n");
        syncFromDom();
        return;
      }

      parentOnKeyDown?.(e);
    },
    [
      multiline,
      showDropdown,
      items,
      highlight,
      applyMention,
      parentOnKeyDown,
      syncFromDom,
    ],
  );

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  type Rest = {
    id?: string;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    readOnly?: boolean;
    style?: React.CSSProperties;
    "aria-label"?: string;
    "aria-labelledby"?: string;
  };
  const r = rest as Rest;
  const { id, placeholder, rows, disabled, readOnly, style } = r;
  const ariaLabel = r["aria-label"];
  const ariaLabelledby = r["aria-labelledby"];

  const minH =
    multiline && typeof rows === "number"
      ? { minHeight: `${Math.max(rows, 2) * 1.45}rem` }
      : undefined;

  const fieldClass = cn(
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent",
    multiline ? "min-h-[4.5rem] whitespace-pre-wrap break-words" : "min-h-[2.75rem]",
    disabled && "cursor-not-allowed opacity-60",
    className,
  );

  const dropdown =
    showDropdown && anchor
      ? createPortal(
          <div
            role="listbox"
            className="fixed z-[200] max-h-[min(22rem,70vh)] overflow-y-auto rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-black/5"
            style={{
              top: anchor.bottom + 4,
              left: anchor.left,
              width: Math.max(anchor.width, 220),
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {groups.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">No matches</p>
            ) : (
              (() => {
                let flatIndex = 0;
                return groups.map((group) => {
                  const { emoji, title } = mentionSectionHeader(group.kind);
                  return (
                    <div
                      key={group.kind}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <div
                        className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-slate-100/80 bg-slate-50/95 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-slate-600 backdrop-blur-sm"
                        aria-hidden
                      >
                        <span className="text-sm" aria-hidden>
                          {emoji}
                        </span>
                        <span>{title}</span>
                      </div>
                      <div className="py-0.5">
                        {group.items.map((raw) => {
                          const item: MentionItem = {
                            kind: raw.kind as MentionItem["kind"],
                            id: raw.id,
                            label: raw.label,
                            sublabel: raw.sublabel,
                          };
                          const i = flatIndex++;
                          return (
                            <button
                              key={`${item.kind}-${item.id}`}
                              type="button"
                              role="option"
                              aria-selected={i === highlight}
                              onMouseEnter={() => setHighlight(i)}
                              onClick={() => applyMention(item)}
                              className={cn(
                                "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition",
                                i === highlight
                                  ? "bg-accent-soft text-accent-ink"
                                  : "text-slate-800 hover:bg-slate-50",
                              )}
                            >
                              <span className="min-w-0 truncate font-medium">
                                {item.label}
                              </span>
                              {item.sublabel ? (
                                <span className="text-[11px] text-slate-500">
                                  {item.sublabel}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="relative w-full">
        {placeholder && !value.trim() ? (
          <span
            className="pointer-events-none absolute left-3 top-2 z-0 text-sm text-slate-400"
            aria-hidden
          >
            {placeholder}
          </span>
        ) : null}
        <div
          ref={ref}
          id={id}
          role="textbox"
          aria-multiline={multiline ? true : undefined}
          aria-placeholder={placeholder}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-disabled={disabled ? true : undefined}
          aria-readonly={readOnly ? true : undefined}
          data-placeholder={placeholder}
          contentEditable={!(disabled || readOnly)}
          suppressContentEditableWarning
          onInput={handleInput}
          onSelect={handleSelectCapture}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className={fieldClass}
          style={{ ...style, ...minH }}
        />
      </div>
      {dropdown}
    </>
  );
}
