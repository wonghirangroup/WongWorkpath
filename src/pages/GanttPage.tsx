import GanttChart from '../components/GanttChart';
import { useAppData } from '../context/AppDataContext';

export default function GanttPage() {
  const { tasks, employees } = useAppData();
  return <GanttChart tasks={tasks} employees={employees} />;
}
