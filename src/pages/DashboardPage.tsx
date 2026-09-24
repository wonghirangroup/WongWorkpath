import { useNavigate } from 'react-router-dom';
import Dashboard from '../components/Dashboard';
import { useAppData } from '../context/AppDataContext';

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
    setTaskSelectedProjectId,
    orgSections,
  } = useAppData();
  const navigate = useNavigate();

  const goToProject = (projectId: string) => {
    setTaskSelectedProjectId(projectId);
    navigate('/tasks');
  };

  return (
    <Dashboard
      projects={projects}
      projectTasks={projectTasks}
      employees={employees}
      currentUser={currentUser}
      onCreateProject={(payload) => handleAddProject({ ...payload, createdBy: currentUser?.id ?? '' })}
      customProjectStatuses={customProjectStatuses}
      customProjectTypes={customProjectTypes}
      onAddCustomProjectType={handleAddCustomProjectType}
      onSelectProject={goToProject}
      orgSections={orgSections}
    />
  );
}
