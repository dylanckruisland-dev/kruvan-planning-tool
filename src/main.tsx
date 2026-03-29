import { ConvexAuthProvider } from "@convex-dev/auth/react";
import {
  Authenticated,
  AuthLoading,
  ConvexReactClient,
  Unauthenticated,
} from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConnectConvex } from "@/ConnectConvex";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { KruvanLogo } from "@/components/brand/KruvanLogo";
import { LoginPage } from "@/pages/LoginPage";
import { AppRouter } from "@/router";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {convexClient ? (
      <ConvexAuthProvider client={convexClient}>
        <div className="h-full min-h-0">
          <AuthLoading>
            <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-[#f6f7f9] text-sm text-slate-600">
              <KruvanLogo size="md" />
              <p className="text-xs text-slate-500">Loading…</p>
            </div>
          </AuthLoading>
          <Unauthenticated>
            <div className="h-full min-h-0 overflow-y-auto">
              <LoginPage />
            </div>
          </Unauthenticated>
          <Authenticated>
            <WorkspaceProvider>
              <AppRouter />
            </WorkspaceProvider>
          </Authenticated>
        </div>
      </ConvexAuthProvider>
    ) : (
      <div className="h-full min-h-0 overflow-y-auto">
        <ConnectConvex />
      </div>
    )}
  </StrictMode>,
);
