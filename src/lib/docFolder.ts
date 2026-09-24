import { LinkedDoc } from '../types';
import { nowTimestamp } from './datetime';

// AddTaskModal's per-task "สร้างโฟลเดอร์เอกสาร" checkbox (whether opened from a project or from the
// Dashboard's quick-add). Returns the new folder's (server-assigned) id so the caller can link it back
// to the task; the folder nests inside the project's own root folder via parentId instead of always
// dropping at the Drive root. (A project's own root folder is NOT made here — the server creates it
// together with the project, in one transaction: see POST /api/projects and createFolderName.)
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
