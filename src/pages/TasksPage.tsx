import ProjectBoard from '../components/projectBoard/ProjectBoard';
import { useAppData } from '../context/AppDataContext';
import { createDocFolder } from '../lib/docFolder';

export default function TasksPage() {
  const { employees, handleAddDocument, currentUser } = useAppData();

  const handleCreateFolder = (name: string, parentId: string | null, taskId: string | undefined, projectId: string) =>
    createDocFolder(name, parentId, taskId, projectId, handleAddDocument, currentUser?.name || 'ผู้ใช้งานปัจจุบัน');

  return <ProjectBoard employees={employees} onCreateFolder={handleCreateFolder} currentUserId={currentUser?.id ?? ''} />;
}
