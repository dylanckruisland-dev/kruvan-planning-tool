import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { getMentionNavigateTarget } from "@/lib/mention-navigation";
import {
  parseTextWithMentions,
  type MentionKind,
} from "@/lib/mention-utils";

const chipClass =
  "inline rounded-md bg-[rgba(var(--kruvan-brand-rgb),0.12)] px-1 py-0.5 text-[0.95em] font-medium text-[color:var(--kruvan-brand)] ring-1 ring-[rgba(var(--kruvan-brand-rgb),0.22)] transition hover:bg-[rgba(var(--kruvan-brand-rgb),0.18)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[rgba(var(--kruvan-brand-rgb),0.35)] focus-visible:ring-offset-1";

function MentionChip({
  kind,
  id,
  label,
}: {
  kind: MentionKind;
  id: string;
  label: string;
}) {
  const navigate = useNavigate();
  const target = getMentionNavigateTarget(kind, id);

  return (
    <span
      role="link"
      tabIndex={target ? 0 : undefined}
      className={cn(chipClass, target && "cursor-pointer select-none")}
      title={target ? `Open ${kind}` : undefined}
      onClick={(e) => {
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        void navigate(target as never);
      }}
      onKeyDown={(e) => {
        if (!target) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          void navigate(target as never);
        }
      }}
    >
      @{label}
    </span>
  );
}

type Props = {
  text: string;
  className?: string;
};

/**
 * Renders plain text with clickable mention chips (`@[Label](mention:kind:id)`).
 * Safe inside `<button>` or `<a>` (uses `span` + programmatic navigation).
 */
export function MentionInlineText({ text, className }: Props) {
  const parts = useMemo(() => parseTextWithMentions(text), [text]);
  return (
    <span className={cn("inline", className)}>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i}>{p.value}</span>
        ) : (
          <MentionChip key={i} kind={p.kind} id={p.id} label={p.label} />
        ),
      )}
    </span>
  );
}
