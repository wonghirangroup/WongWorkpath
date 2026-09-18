import { LinkedDoc } from '../types';
import { nowTimestamp } from './datetime';

// Shared by every "สร้างโฟลเดอร์เอกสาร" checkbox (CreateProjectModal's own step, AddTaskModal's
// per-task checkbox whether opened from a project or from the Dashboard's quick-add) — one place
// for the actual LinkedDoc shape so they can't drift apart. Returns the new folder's (server-
// assigned) id so callers can link it back to whatever created it (a project saves it as its own
// docFolderId; a task's folder nests inside that via parentId instead of always dropping at the
// Drive root). A project's own root folder always starts scoped 'โครงการ' + tagged to that project,
// since it's created together with (and only ever visible to) that project's own team.
export async function createDocFolder(
  name: string,
  parentId: string | null,
  taskId: string | undefined,
  projectId: string,
  addDocument: (doc: Omit<LinkedDoc, 'id'>) => Promise<LinkedDoc>,
  currentUserName: string
): Promise<string> {
  const date = nowTimestamp();
  const created = await addDocument({
    name,
    kind: 'folder',
    parentId,
    taskId,
    scope: 'โครงการ',
    projectId,
    version: 1,
    lastUpdated: date,
    updatedBy: currentUserName,
    history: [{ version: 1, updatedBy: currentUserName, date, note: 'สร้างโฟลเดอร์จากการสร้างโครงการใหม่' }],
  });
  return created.id;
}
