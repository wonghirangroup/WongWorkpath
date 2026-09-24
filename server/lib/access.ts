import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.ts';

// Who the caller is and what they may see — loaded once per request from the authenticated
// employee id (never from anything the client claims). Shared by the routes whose visibility is
// per-user: documents and the credential vault.
export interface ActorContext {
  id: string;
  department: string | null;
  isExecutive: boolean;
  // admin / superadmin / executive — the accounts that reach Employee Management.
  isAdminLike: boolean;
  // Projects this person owns or is a member of ("รับผิดชอบ"). Empty for executives, who see every
  // project — use canSeeProject rather than reading this directly.
  projectIds: Set<string>;
}

export async function loadActorContext(actorId: string): Promise<ActorContext> {
  const [[employee]] = await pool.query<RowDataPacket[]>('SELECT department, account_type FROM employee WHERE id = ?', [actorId]);
  const isExecutive = employee?.account_type === 'executive';

  const projectIds = new Set<string>();
  if (!isExecutive) {
    const [projectRows] = await pool.query<RowDataPacket[]>('SELECT id, owner_employee_ids, member_employee_ids FROM project');
    for (const p of projectRows) {
      const owners: string[] = p.owner_employee_ids ? JSON.parse(p.owner_employee_ids) : [];
      const members: string[] = p.member_employee_ids ? JSON.parse(p.member_employee_ids) : [];
      if (owners.includes(actorId) || members.includes(actorId)) projectIds.add(p.id);
    }
  }
  const isAdminLike = isExecutive || employee?.account_type === 'admin' || employee?.account_type === 'superadmin';
  return { id: actorId, department: employee?.department ?? null, isExecutive, isAdminLike, projectIds };
}

export function canSeeProject(ctx: ActorContext, projectId: string | null | undefined): boolean {
  return Boolean(projectId && (ctx.isExecutive || ctx.projectIds.has(projectId)));
}

// Adding something to a project's Drive is a little wider than seeing it: an admin can attach files
// to a task in a project they administer without being on its team. Reading, editing and deleting
// existing docs still follow canSeeDocument.
export function canAddToProject(ctx: ActorContext, projectId: string | null | undefined): boolean {
  return Boolean(projectId && (ctx.isAdminLike || ctx.projectIds.has(projectId)));
}

// A doc scoped 'ส่วนตัว' belongs to whoever created it and nobody else — not even an executive. A
// doc scoped 'โครงการ' belongs to that project's people (executives see every project).
export function canSeeDocument(ctx: ActorContext, doc: { scope: string; creator_employee_id: string | null; project_id: string | null }): boolean {
  return doc.scope === 'ส่วนตัว' ? doc.creator_employee_id === ctx.id : canSeeProject(ctx, doc.project_id);
}

// 'ส่วนตัว' only to its creator; 'ทีม' to the same department (executives: every team); 'โครงการ' to
// that project's people.
export function canSeeCredential(
  ctx: ActorContext,
  cred: { scope: string; creator_employee_id: string | null; team: string | null; project_id: string | null }
): boolean {
  if (cred.scope === 'ส่วนตัว') return cred.creator_employee_id === ctx.id;
  if (cred.scope === 'ทีม') return ctx.isExecutive || (ctx.department !== null && cred.team === ctx.department);
  return canSeeProject(ctx, cred.project_id);
}
