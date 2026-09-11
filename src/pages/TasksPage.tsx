import ProjectBoard from '../components/projectBoard/ProjectBoard';
import { useAppData } from '../context/AppDataContext';
import { LinkedDoc } from '../types';
import { nowTimestamp } from '../lib/datetime';

export default function TasksPage() {
  const { employees, documents, saveDocuments, currentUser } = useAppData();

  const handleCreateFolder = (name: string) => {
    const date = nowTimestamp();
    const newDoc: LinkedDoc = {
      id: 'DOC' + Date.now(),
      name,
      kind: 'folder',
      parentId: null,
      scope: 'ส่วนตัว',
      version: 1,
      lastUpdated: date,
      updatedBy: currentUser?.name || 'ผู้ใช้งานปัจจุบัน',
      history: [{ version: 1, updatedBy: currentUser?.name || 'ผู้ใช้งานปัจจุบัน', date, note: 'สร้างโฟลเดอร์จากการสร้างโครงการใหม่' }]
    };
    saveDocuments([...documents, newDoc]);
  };

  return <ProjectBoard employees={employees} onCreateFolder={handleCreateFolder} currentUserId={currentUser?.id ?? ''} />;
}
