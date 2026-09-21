import SettingsView from '../components/SettingsView';
import { useAppData } from '../context/AppDataContext';

export default function SettingsPage() {
  const { currentUser, changeRequests, handleUpdateEmployee, handleRequestChange, handleChangeSelfPassword, handleRefreshAccountData } = useAppData();
  if (!currentUser) return null;

  return (
    <SettingsView
      currentUser={currentUser}
      changeRequests={changeRequests}
      onUpdateEmployee={handleUpdateEmployee}
      onRequestChange={handleRequestChange}
      onChangePassword={handleChangeSelfPassword}
      onRefresh={handleRefreshAccountData}
    />
  );
}
