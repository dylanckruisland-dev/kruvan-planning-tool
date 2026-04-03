import {
  Calendar,
  CheckSquare,
  Clapperboard,
  FolderKanban,
  LayoutGrid,
  Mail,
  Settings,
  StickyNote,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useOpenTabs } from "@/contexts/OpenTabsContext";
import type { OpenTab, OpenTabType } from "@/lib/open-tabs";
import { cn } from "@/lib/cn";

const TYPE_ICONS: Record<OpenTabType, LucideIcon> = {
  overview: LayoutGrid,
  projects: FolderKanban,
  project: FolderKanban,
  tasks: CheckSquare,
  task: CheckSquare,
  notes: StickyNote,
  note: StickyNote,
  agenda: Calendar,
  event: Calendar,
  content: Clapperboard,
  contentItem: Clapperboard,
  messages: Mail,
  settings: Settings,
};

export function OpenTabsBar() {
  const { tabs, activeKey, closeTab, activateTab } = useOpenTabs();

  if (tabs.length === 0) return null;

  return (
    <div className="flex min-h-[2.25rem] items-stretch gap-0.5 overflow-x-auto overscroll-x-contain border-b border-slate-200/70 bg-[#f6f7f9]/90 py-1 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
      {tabs.map((tab: OpenTab) => {
        const Icon: LucideIcon =
          TYPE_ICONS[tab.type as OpenTabType] ?? LayoutGrid;
        const isActive = tab.key === activeKey;
        return (
          <div
            key={tab.key}
            className={cn(
              "group relative flex max-w-[min(100%,14rem)] shrink-0 items-center rounded-lg border border-transparent transition",
              isActive
                ? "border-slate-200/90 bg-white text-slate-900 shadow-sm"
                : "bg-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white/70 hover:text-slate-900",
            )}
          >
            <button
              type="button"
              onClick={() => activateTab(tab)}
              title={tab.title}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-2 pr-1 text-left text-[13px] font-medium leading-tight"
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0 opacity-70",
                  isActive && "text-accent-ink opacity-100",
                )}
                strokeWidth={2}
                aria-hidden
              />
              <span className="min-w-0 truncate">{tab.title}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.key);
              }}
              className={cn(
                "mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200/80 hover:text-slate-700",
                "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                isActive && "opacity-90 group-hover:opacity-100",
              )}
              aria-label={`Close ${tab.title}`}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
