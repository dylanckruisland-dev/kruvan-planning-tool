import type { ReactNode } from "react";
import { ShellActionsContext } from "./shellActionsContext";

export function ShellActionsProvider({
  children,
  openQuickAdd,
}: {
  children: ReactNode;
  openQuickAdd: (opts?: { voice?: boolean }) => void;
}) {
  return (
    <ShellActionsContext.Provider value={{ openQuickAdd }}>
      {children}
    </ShellActionsContext.Provider>
  );
}
