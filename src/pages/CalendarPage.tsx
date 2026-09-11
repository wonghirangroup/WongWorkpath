import CalendarView from '../components/CalendarView';
import { useAppData } from '../context/AppDataContext';

export default function CalendarPage() {
  const { tasks } = useAppData();
  return (
    <CalendarView tasks={tasks} />
  );
}
