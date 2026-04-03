import { createContext } from "react";

export type ShellActions = {
  openQuickAdd: (opts?: { voice?: boolean }) => void;
};

export const ShellActionsContext = createContext<ShellActions | null>(null);
