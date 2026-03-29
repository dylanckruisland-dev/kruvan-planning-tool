import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { CreateFirstWorkspace } from "@/components/layout/CreateFirstWorkspace";
import { WorkspaceContext } from "@/context/workspace-context";
import {
  accentHexToRgbComma,
  normalizeWorkspaceAccent,
} from "@/lib/workspace-accent";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspaces = useQuery(api.workspaces.list);
  const [selectedId, setSelectedId] = useState<Id<"workspaces"> | null>(null);

  const workspaceId = useMemo(() => {
    if (!workspaces?.length) return null;
    if (selectedId && workspaces.some((w) => w._id === selectedId)) {
      return selectedId;
    }
    return workspaces[0]._id;
  }, [workspaces, selectedId]);

  const workspace = useMemo(() => {
    if (!workspaceId || !workspaces) return null;
    return workspaces.find((w) => w._id === workspaceId) ?? null;
  }, [workspaceId, workspaces]);

  const workspaceName = workspace?.name ?? null;

  const ready = workspaces !== undefined && workspaceId !== null;

  const setWorkspaceId = useCallback((id: Id<"workspaces">) => {
    setSelectedId(id);
  }, []);

  useEffect(() => {
    const accent = normalizeWorkspaceAccent(workspace?.accent);
    const rgb = accentHexToRgbComma(accent);
    const root = document.documentElement;
    root.style.setProperty("--workspace-accent", accent);
    root.style.setProperty("--workspace-accent-rgb", rgb);
    return () => {
      root.style.removeProperty("--workspace-accent");
      root.style.removeProperty("--workspace-accent-rgb");
    };
  }, [workspace?.accent]);

  const value = useMemo(
    () => ({
      workspaceId,
      setWorkspaceId,
      workspaceName,
      workspace,
      ready,
    }),
    [workspaceId, setWorkspaceId, workspaceName, workspace, ready],
  );

  if (workspaces !== undefined && workspaces.length === 0) {
    return <CreateFirstWorkspace />;
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
