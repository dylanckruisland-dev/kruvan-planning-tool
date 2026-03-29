import { createContext } from "react";
import type { Doc, Id } from "@cvx/_generated/dataModel";

export type WorkspaceContextValue = {
  workspaceId: Id<"workspaces"> | null;
  setWorkspaceId: (id: Id<"workspaces">) => void;
  workspaceName: string | null;
  /** Full workspace doc for the active workspace (from list). */
  workspace: Doc<"workspaces"> | null;
  ready: boolean;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);
