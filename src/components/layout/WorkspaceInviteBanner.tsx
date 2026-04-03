import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/cn";
import { Inbox } from "lucide-react";

export function WorkspaceInviteBanner() {
  const invites = useQuery(api.collaboration.listMyPendingInvites);
  const accept = useMutation(api.collaboration.acceptInvite);
  const decline = useMutation(api.collaboration.declineInvite);
  const { setWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  if (!invites?.length) return null;

  const inv = invites[0];
  const more = invites.length - 1;

  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-2xl border border-accent-outline/30 bg-[rgba(var(--kruvan-brand-rgb),0.08)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-black/5">
          <Inbox className="h-4 w-4 text-[color:var(--kruvan-brand)]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Workspace invitation
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            <span className="font-medium text-slate-800">
              {inv.invitedByName}
            </span>{" "}
            invited you to{" "}
            <span className="font-medium text-slate-800">
              {inv.workspaceName}
            </span>
            {inv.role === "admin" ? " as an admin" : " as a member"}.
            {more > 0 ? ` ${more} more pending invite${more > 1 ? "s" : ""}.` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => {
            void (async () => {
              try {
                await decline({ inviteId: inv.inviteId });
                toast("Invitation declined", "success");
              } catch (e) {
                toast(
                  e instanceof Error ? e.message : "Could not decline",
                  "error",
                );
              }
            })();
          }}
          className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => {
            void (async () => {
              try {
                await accept({ inviteId: inv.inviteId });
                setWorkspaceId(inv.workspaceId);
                toast(`Joined ${inv.workspaceName}`, "success");
              } catch (e) {
                toast(
                  e instanceof Error ? e.message : "Could not accept",
                  "error",
                );
              }
            })();
          }}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
