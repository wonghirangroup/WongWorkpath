// Mirrors server/lib/ownership.ts's isOwner exactly — client-side check used to decide whether to
// render the normal save/delete UI or the "request change" flow, before the server enforces the
// same rule for real on the PUT/DELETE routes.
export function isOwner(ownerIds: string[], userId: string): boolean {
  return ownerIds.length === 0 || ownerIds.includes(userId);
}

// Drops any owner/assignee id that no longer matches a real, current employee (e.g. that person
// was deleted after being set as a project's owner or a task's assignee) — always pass an
// ownerEmployeeIds/assigneeEmployeeIds array through this before handing it to isOwner. Without
// it, a dangling id still counts as "owned by someone" and permanently forces the change-request
// flow, even though the UI itself already shows no owner for a reference like that ("ยังไม่มี").
export function resolveValidIds(ids: string[], employees: { id: string }[]): string[] {
  const validIds = new Set(employees.map((e) => e.id));
  return ids.filter((id) => validIds.has(id));
}

// "รับผิดชอบโครงการ" for view-scoping purposes (Dashboard/จัดการงานฯ/ปฏิทิน default filters) — owner
// OR member, no "unowned = everyone" fallback (unlike isOwner above, which is about who may edit
// an unowned project, not who a personal "my projects" view should include). Matches the
// definition MyWorkspace.tsx's own `myProjects` filter already used before this helper existed.
export function isResponsibleForProject(
  project: { ownerEmployeeIds: string[]; memberEmployeeIds?: string[] },
  employeeId: string
): boolean {
  return project.ownerEmployeeIds.includes(employeeId) || (project.memberEmployeeIds ?? []).includes(employeeId);
}
