import { useNavigate } from 'react-router-dom';
import TaskListView from '../components/TaskListView';
import { useAppData } from '../context/AppDataContext';

export default function TasksPage() {
  const navigate = useNavigate();
  const {
    tasks,
    employees,
    documents,
    openAddTaskModal,
    openEditTaskModal,
    handleDeleteTask,
    handleInitiateHandover
  } = useAppData();

  return (
    <TaskListView
      tasks={tasks}
      employees={employees}
      documents={documents}
      onAddTask={openAddTaskModal}
      onEditTask={openEditTaskModal}
      onDeleteTask={handleDeleteTask}
      onInitiateHandover={handleInitiateHandover}
      onOpenDoc={(docId) => navigate('/docs', { state: { docId } })}
    />
  );
}
