import { useNavigate } from 'react-router-dom';
import MyWorkspace from '../components/MyWorkspace';
import { useAppData } from '../context/AppDataContext';

export default function GanttPage() {
  const { projectTasks, projects, employees, documents, currentUser, handleUpdateProjectTask, handleAddDocument, setTaskSelectedProjectId, changeRequests, handleDecideChangeRequest } = useAppData();
  const navigate = useNavigate();

  const goToProject = (projectId: string) => {
    setTaskSelectedProjectId(projectId);
    navigate('/tasks');
  };

  return (
    <MyWorkspace
      projectTasks={projectTasks}
      projects={projects}
      employees={employees}
      documents={documents}
      currentUserId={currentUser?.id ?? ''}
      onUpdateTask={handleUpdateProjectTask}
      onAddDocument={handleAddDocument}
      onSelectProject={goToProject}
      changeRequests={changeRequests}
      onDecideChangeRequest={handleDecideChangeRequest}
    />
  );
}
