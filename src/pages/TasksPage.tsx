import ProjectBoard from '../components/projectBoard/ProjectBoard';
import { useAppData } from '../context/AppDataContext';
import { createDocFolder } from '../lib/docFolder';

export default function TasksPage() {
  const { employees, documents, saveDocuments, currentUser } = useAppData();

  const handleCreateFolder = (name: string, parentId: string | null = null, taskId?: string) =>
    createDocFolder(name, parentId, taskId, documents, saveDocuments, currentUser?.name || 'ผู้ใช้งานปัจจุบัน');

  return <ProjectBoard employees={employees} onCreateFolder={handleCreateFolder} currentUserId={currentUser?.id ?? ''} />;
}
