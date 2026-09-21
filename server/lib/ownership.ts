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

// Drops any owner/assignee id that no longer matches a real, current employee row (e.g. that
// person was deleted after being set as a project's owner or a task's assignee) — always pass an
// ownerEmployeeIds/assigneeEmployeeIds array through this before handing it to isOwner. Without
// it, a dangling id still counts as "owned by someone" and permanently forces the change-request
// flow, even though the UI itself already shows no owner for a reference like that ("ยังไม่มี").
export async function resolveValidOwnerIds(ownerIds: string[]): Promise<string[]> {
  if (ownerIds.length === 0) return [];
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM employee WHERE id IN (${ownerIds.map(() => '?').join(',')})`,
    ownerIds
  );
  return rows.map((r) => r.id as string);
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
