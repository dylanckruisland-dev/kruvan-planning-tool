import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
  /** Where the menu opens (default right). */
  menuAlign?: "left" | "right";
};

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  className,
  menuAlign = "right",
}: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find((o) => o.value === value)?.label ?? label;

  return (
    <div className={cn("relative", className)} ref={root}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        {current}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open ? (
        <div
          className={cn(
            "absolute z-40 mt-1 min-w-[10rem] rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-black/5",
            menuAlign === "left" ? "left-0" : "right-0",
          )}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50",
                o.value === value && "bg-accent-soft text-accent-ink",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
