import { useMutation, useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/cn";
import { Mail, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

const selectClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none input-focus-accent";

type MemberRow = {
  kind: "owner" | "admin" | "member";
  userId: Id<"users">;
  name: string | null;
  email: string | null;
  image?: string | null;
  membershipId?: Id<"workspaceUserMemberships">;
};

function roleLabel(kind: MemberRow["kind"]) {
  if (kind === "owner") return "Owner";
  if (kind === "admin") return "Admin";
  return "Member";
}

function roleBadgeClass(kind: MemberRow["kind"]) {
  if (kind === "owner")
    return "bg-violet-100 text-violet-800 ring-violet-200/80";
  if (kind === "admin") return "bg-amber-50 text-amber-900 ring-amber-200/80";
  return "bg-slate-100 text-slate-700 ring-slate-200/80";
}

export function WorkspaceCollaborationSection({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) {
  const { toast } = useToast();
  const members = useQuery(api.collaboration.listMembers, { workspaceId });
  const roleInfo = useQuery(api.collaboration.myRoleInWorkspace, {
    workspaceId,
  });
  const canSeeOutgoing =
    roleInfo !== undefined &&
    roleInfo !== null &&
    (roleInfo.role === "owner" || roleInfo.role === "admin");
  const outgoing = useQuery(
    api.collaboration.listOutgoingInvites,
    canSeeOutgoing ? { workspaceId } : "skip",
  );

  const inviteByEmail = useMutation(api.collaboration.inviteByEmail);
  const cancelInvite = useMutation(api.collaboration.cancelInvite);
  const removeMember = useMutation(api.collaboration.removeMember);
  const updateMemberRole = useMutation(api.collaboration.updateMemberRole);
  const syncAssignees = useMutation(
    api.workspaceMembers.syncCollaboratorsToAssignees,
  );

  useEffect(() => {
    void syncAssignees({ workspaceId });
  }, [workspaceId, syncAssignees]);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<Id<"users"> | null>(
    null,
  );
  const [roleBusy, setRoleBusy] = useState<Id<"users"> | null>(null);

  const myRole = roleInfo?.role ?? null;
  const isOwner = myRole === "owner";
  const isAdminOrOwner = myRole === "owner" || myRole === "admin";

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setInviteBusy(true);
    try {
      await inviteByEmail({
        workspaceId,
        email: trimmed,
        role: inviteRole,
      });
      setEmail("");
      toast("Invitation sent", "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not send invite",
        "error",
      );
    } finally {
      setInviteBusy(false);
    }
  }

  async function onRemove(targetUserId: Id<"users">) {
    setRemovingUserId(targetUserId);
    try {
      await removeMember({ workspaceId, targetUserId });
      toast("Member removed", "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not remove member",
        "error",
      );
    } finally {
      setRemovingUserId(null);
    }
  }

  async function onRoleChange(
    targetUserId: Id<"users">,
    next: "admin" | "member",
  ) {
    setRoleBusy(targetUserId);
    try {
      await updateMemberRole({ workspaceId, targetUserId, role: next });
      toast("Role updated", "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not update role",
        "error",
      );
    } finally {
      setRoleBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-100">
          <Users className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Workspace members
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Invite people with a Kruvan account to collaborate. They must accept
            the invitation before they can access this workspace. Everyone here
            is added automatically to the task assignee list for this workspace.
          </p>
        </div>
      </div>

      {members === undefined ? (
        <div className="mt-6 h-28 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {members.map((m: MemberRow) => {
            const canChangeRole =
              isOwner && m.kind !== "owner" && m.membershipId;
            const showRemove =
              isAdminOrOwner &&
              m.kind !== "owner" &&
              (myRole === "owner" ||
                (myRole === "admin" && m.kind === "member"));

            return (
              <li
                key={String(m.userId)}
                className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {m.name ?? m.email ?? "User"}
                  </p>
                  {m.email ? (
                    <p className="truncate text-xs text-slate-500">{m.email}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canChangeRole ? (
                    <select
                      className={cn(
                        selectClass,
                        "mt-0 min-w-[7.5rem] py-1.5 text-xs",
                      )}
                      value={m.kind}
                      disabled={roleBusy === m.userId}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "admin" || v === "member") {
                          void onRoleChange(m.userId, v);
                        }
                      }}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
                        roleBadgeClass(m.kind),
                      )}
                    >
                      {m.kind === "admin" ? (
                        <Shield className="h-3 w-3 opacity-80" />
                      ) : null}
                      {roleLabel(m.kind)}
                    </span>
                  )}
                  {showRemove ? (
                    <button
                      type="button"
                      onClick={() => void onRemove(m.userId)}
                      disabled={removingUserId === m.userId}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      aria-label={`Remove ${m.name ?? m.email ?? "member"}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isAdminOrOwner && outgoing !== undefined && outgoing.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-medium text-slate-600">
            Pending invitations
          </p>
          <ul className="mt-2 space-y-2">
            {outgoing.map((o) => (
              <li
                key={String(o.inviteId)}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-amber-700/80" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {o.email}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {o.role === "admin" ? "Admin" : "Member"} · Invited by{" "}
                      {o.invitedByName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      try {
                        await cancelInvite({ inviteId: o.inviteId });
                        toast("Invite cancelled", "success");
                      } catch (err) {
                        toast(
                          err instanceof Error
                            ? err.message
                            : "Could not cancel",
                          "error",
                        );
                      }
                    })();
                  }}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white/80"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isOwner ? (
        <form onSubmit={(e) => void onInvite(e)} className="mt-6 space-y-3">
          <p className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <UserPlus className="h-3.5 w-3.5" />
            Invite by email
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div>
              <label htmlFor="collab-email" className="text-xs text-slate-500">
                Email address
              </label>
              <input
                id="collab-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="collab-role" className="text-xs text-slate-500">
                Role
              </label>
              <select
                id="collab-role"
                className={selectClass}
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(
                    e.target.value === "admin" ? "admin" : "member",
                  )
                }
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end sm:pb-0.5">
              <button
                type="submit"
                disabled={inviteBusy || !email.trim()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40"
              >
                {inviteBusy ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Only users who already have a Kruvan account can be invited. Admins
            can remove members; only the owner can invite, change roles, or
            remove admins.
          </p>
        </form>
      ) : (
        <p className="mt-6 text-xs text-slate-500">
          Only the workspace owner can send invitations. Ask the owner to add
          collaborators, or check pending invites in the banner above.
        </p>
      )}
    </div>
  );
}
