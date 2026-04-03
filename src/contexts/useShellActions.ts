import { useContext } from "react";
import { ShellActionsContext } from "./shellActionsContext";

export function useShellActions() {
  const v = useContext(ShellActionsContext);
  if (!v) {
    throw new Error("useShellActions must be used within ShellActionsProvider");
  }
  return v;
}
