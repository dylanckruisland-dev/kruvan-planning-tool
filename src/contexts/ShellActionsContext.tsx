import { createContext, useContext, type ReactNode } from "react";

type ShellActions = {
  openQuickAdd: () => void;
};

const ShellActionsContext = createContext<ShellActions | null>(null);

export function ShellActionsProvider({
  children,
  openQuickAdd,
}: {
  children: ReactNode;
  openQuickAdd: () => void;
}) {
  return (
    <ShellActionsContext.Provider value={{ openQuickAdd }}>
      {children}
    </ShellActionsContext.Provider>
  );
}

export function useShellActions() {
  const v = useContext(ShellActionsContext);
  if (!v) {
    throw new Error("useShellActions must be used within ShellActionsProvider");
  }
  return v;
}
