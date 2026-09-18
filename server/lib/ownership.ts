import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';

// Shared by projects.ts and project-tasks.ts: once an entity has at least one owner, only one of
// those owners may edit/delete it directly — anyone else must go through change-requests.ts.
// An entity with zero owners is unowned and stays open to everyone, same as before this feature.
export function isOwner(ownerIds: string[], actorId: string | undefined | null): boolean {
  if (ownerIds.length === 0) return true;
  if (!actorId) return false;
  return ownerIds.includes(actorId);
}

// ผู้บริหาร bypasses the ownership gate everywhere server-side too (mirrors the client's
// isExecutive checks in ProjectBoard/ProjectDetail/AddTaskModal/EditProjectModal) — looked up by
// id rather than trusting a client-sent role, same trust level as the rest of this app's
// "actorEmployeeId" checks (no real session/auth layer exists to verify it against).
export async function isExecutiveActor(actorId: string | undefined | null): Promise<boolean> {
  if (!actorId) return false;
  const [[row]] = await pool.query<RowDataPacket[]>('SELECT account_type FROM employee WHERE id = ?', [actorId]);
  return row?.account_type === 'executive';
}
