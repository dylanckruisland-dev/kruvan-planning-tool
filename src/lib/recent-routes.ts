import { APP_NAV_LINKS } from "@/config/nav";

const STORAGE_KEY = "kruvan-recent-routes";
const MAX = 5;

/** Remember last visited paths for command palette “Recent”. */
export function pushRecentRoute(pathname: string): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    let arr: string[] = raw ? JSON.parse(raw) : [];
    arr = arr.filter((p) => p !== pathname);
    arr.unshift(pathname);
    arr = arr.slice(0, MAX);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export function readRecentRoutes(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recentRouteLabel(path: string): string {
  if (path === "/") return "Overview";
  const nav = APP_NAV_LINKS.find((l) => l.to === path);
  if (nav) return nav.label;
  if (/^\/projects\/[^/]+$/.test(path)) return "Project";
  return path;
}
