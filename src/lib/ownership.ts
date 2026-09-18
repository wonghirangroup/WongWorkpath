// Mirrors server/lib/ownership.ts's isOwner exactly — client-side check used to decide whether to
// render the normal save/delete UI or the "request change" flow, before the server enforces the
// same rule for real on the PUT/DELETE routes.
export function isOwner(ownerIds: string[], userId: string): boolean {
  return ownerIds.length === 0 || ownerIds.includes(userId);
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
