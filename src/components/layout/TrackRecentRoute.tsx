import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { pushRecentRoute } from "@/lib/recent-routes";

/** Records pathname changes for command palette “Recent”. */
export function TrackRecentRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    pushRecentRoute(pathname);
  }, [pathname]);
  return null;
}
