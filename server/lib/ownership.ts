// Shared by projects.ts and project-tasks.ts: once an entity has at least one owner, only one of
// those owners may edit/delete it directly — anyone else must go through change-requests.ts.
// An entity with zero owners is unowned and stays open to everyone, same as before this feature.
export function isOwner(ownerIds: string[], actorId: string | undefined | null): boolean {
  if (ownerIds.length === 0) return true;
  if (!actorId) return false;
  return ownerIds.includes(actorId);
}
