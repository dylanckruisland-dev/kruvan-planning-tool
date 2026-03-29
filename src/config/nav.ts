import {
  Calendar,
  CheckSquare,
  Clapperboard,
  FolderKanban,
  LayoutGrid,
  Settings,
  StickyNote,
} from "lucide-react";

/** Primary app routes — shared by sidebar, command palette, and “recent” labels. */
export const APP_NAV_LINKS = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/content", label: "Content", icon: Clapperboard },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export type AppNavPath = (typeof APP_NAV_LINKS)[number]["to"];
