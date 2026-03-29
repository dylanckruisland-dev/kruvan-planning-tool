import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

type Props = { children: ReactNode };

/**
 * Subtle fade/slide on route change; disabled via prefers-reduced-motion in CSS.
 */
export function PageTransition({ children }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div key={pathname} className="page-shell-enter">
      {children}
    </div>
  );
}
