import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { Notification } from '../../types';

// Shared by the Header's bell panel and the corner NotificationToast: opening a notification marks
// it read and, when it points at a project (every current trigger does — task and meeting
// notifications all deep-link to their parent project), jumps straight to that project's detail
// view on the Tasks page.
export function useOpenNotification() {
  const navigate = useNavigate();
  const { handleMarkNotificationRead, setTaskSelectedProjectId } = useAppData();

  return (notif: Notification) => {
    if (!notif.read) handleMarkNotificationRead(notif.id);
    if (notif.linkId) {
      setTaskSelectedProjectId(notif.linkId);
      navigate('/tasks');
    }
  };
}
