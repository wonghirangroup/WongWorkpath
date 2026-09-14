import { LinkedDoc } from '../types';
import { nowTimestamp } from './datetime';

// Shared by every "สร้างโฟลเดอร์เอกสาร" checkbox (CreateProjectModal's own step, AddTaskModal's
// per-task checkbox whether opened from a project or from the Dashboard's quick-add) — one place
// for the actual LinkedDoc shape so they can't drift apart. Returns the new folder's id so callers
// can link it back to whatever created it (a project saves it as its own docFolderId; a task's
// folder nests inside that via parentId instead of always dropping at the Drive root).
export function createDocFolder(
  name: string,
  parentId: string | null,
  taskId: string | undefined,
  documents: LinkedDoc[],
  saveDocuments: (docs: LinkedDoc[]) => void,
  currentUserName: string
): string {
  const date = nowTimestamp();
  const id = 'DOC' + Date.now();
  const newDoc: LinkedDoc = {
    id,
    name,
    kind: 'folder',
    parentId,
    taskId,
    scope: 'ส่วนตัว',
    version: 1,
    lastUpdated: date,
    updatedBy: currentUserName,
    history: [{ version: 1, updatedBy: currentUserName, date, note: 'สร้างโฟลเดอร์จากการสร้างโครงการใหม่' }],
  };
  saveDocuments([...documents, newDoc]);
  return id;
}
