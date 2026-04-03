import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { Id } from "@cvx/_generated/dataModel";

type ProjectRow = { _id: Id<"projects">; name: string };

const triggerClass =
  "mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 outline-none transition hover:border-slate-300 input-focus-accent disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  projects: ProjectRow[] | undefined;
  value: Id<"projects"> | null;
  onChange: (value: Id<"projects"> | null) => void;
  className?: string;
  id?: string;
};

export function ProjectSearchSelect({
  projects,
  value,
  onChange,
  className,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const sorted = useMemo(() => {
    const list = projects ?? [];
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(s));
  }, [sorted, q]);

  const selectedLabel = value
    ? (sorted.find((p) => p._id === value)?.name ?? "Project")
    : "No project";

  return (
    <div className={cn("relative", className)} ref={root}>
      <button
        id={id}
        type="button"
        disabled={projects === undefined}
        onClick={() => projects !== undefined && setOpen((o) => !o)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && projects !== undefined ? (
        <div
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-black/5"
          role="listbox"
        >
          <div className="border-b border-slate-100 px-2 pb-1.5 pt-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search projects…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-1.5 pl-8 pr-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto py-0.5">
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                "flex w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50",
                value === null && "bg-accent-soft text-accent-ink",
              )}
            >
              No project
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">No matches</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  role="option"
                  aria-selected={value === p._id}
                  onClick={() => {
                    onChange(p._id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50",
                    value === p._id && "bg-accent-soft text-accent-ink",
                  )}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
