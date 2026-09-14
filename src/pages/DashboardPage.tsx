import { useNavigate } from 'react-router-dom';
import Dashboard from '../components/Dashboard';
import { useAppData } from '../context/AppDataContext';

export default function DashboardPage() {
  const { projects, projectTasks, employees, orgSections, currentUser, openAddTaskModal, setTaskSelectedProjectId } = useAppData();
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
      orgSections={orgSections}
      currentUser={currentUser}
      onAddTask={openAddTaskModal}
      onSelectProject={goToProject}
    />
  );
}
