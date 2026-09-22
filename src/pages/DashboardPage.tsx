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
    customProjectTypes,
    handleAddCustomProjectType,
    handleAddDocument,
    setTaskSelectedProjectId,
    orgSections,
  } = useAppData();
  const navigate = useNavigate();

  const goToProject = (projectId: string) => {
    setTaskSelectedProjectId(projectId);
    navigate('/tasks');
  };

  const handleCreateFolder = (name: string, parentId: string | null, taskId: string | undefined, projectId: string) =>
    createDocFolder(name, parentId, taskId, projectId, handleAddDocument, currentUser?.name || 'ผู้ใช้งานปัจจุบัน');

  return (
    <Dashboard
      projects={projects}
      projectTasks={projectTasks}
      employees={employees}
      currentUser={currentUser}
      onCreateProject={async (payload) => { await handleAddProject({ ...payload, createdBy: currentUser?.id ?? '' }); }}
      onCreateFolder={handleCreateFolder}
      customProjectStatuses={customProjectStatuses}
      customProjectTypes={customProjectTypes}
      onAddCustomProjectType={handleAddCustomProjectType}
      onSelectProject={goToProject}
      orgSections={orgSections}
    />
  );
}
