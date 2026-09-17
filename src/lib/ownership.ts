// Mirrors server/lib/ownership.ts's isOwner exactly — client-side check used to decide whether to
// render the normal save/delete UI or the "request change" flow, before the server enforces the
// same rule for real on the PUT/DELETE routes.
export function isOwner(ownerIds: string[], userId: string): boolean {
  return ownerIds.length === 0 || ownerIds.includes(userId);
}
