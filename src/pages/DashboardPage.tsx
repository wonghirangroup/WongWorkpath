import { useNavigate } from 'react-router-dom';
import Dashboard from '../components/Dashboard';
import { useAppData } from '../context/AppDataContext';
import { createDocFolder } from '../lib/docFolder';

export default function DashboardPage() {
  const {
    projects,
    projectTasks,
    employees,
    currentUser,
    handleAddProject,
    customProjectStatuses,
    documents,
    saveDocuments,
    setTaskSelectedProjectId,
  } = useAppData();
  const navigate = useNavigate();

  const goToProject = (projectId: string) => {
    setTaskSelectedProjectId(projectId);
    navigate('/tasks');
  };

  const handleCreateFolder = (name: string, parentId: string | null = null, taskId?: string) =>
    createDocFolder(name, parentId, taskId, documents, saveDocuments, currentUser?.name || 'ผู้ใช้งานปัจจุบัน');

  return (
    <Dashboard
      projects={projects}
      projectTasks={projectTasks}
      employees={employees}
      currentUser={currentUser}
      onCreateProject={async (payload) => { await handleAddProject({ ...payload, createdBy: currentUser?.id ?? '' }); }}
      onCreateFolder={handleCreateFolder}
      customProjectStatuses={customProjectStatuses}
      onSelectProject={goToProject}
    />
  );
}
