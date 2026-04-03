import type { Doc } from "@cvx/_generated/dataModel";

export function taskAssigneeLabel(
  task: Doc<"tasks">,
  memberName: Map<string, string>,
  legacyUserName: Map<string, string>,
): string | undefined {
  if (task.assigneeMemberId) {
    return memberName.get(String(task.assigneeMemberId));
  }
  if (task.assigneeId) {
    const n = legacyUserName.get(String(task.assigneeId));
    return n && n.length > 0 ? n : undefined;
  }
  return undefined;
}
