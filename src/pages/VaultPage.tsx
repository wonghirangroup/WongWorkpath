import CredentialVault from '../components/CredentialVault';
import { useAppData } from '../context/AppDataContext';

export default function VaultPage() {
  const { credentials, auditLogs, currentUser, handleAddCredential, handleUpdateCredential, handleDeleteCredential, handleLogAudit } = useAppData();
  return (
    <CredentialVault
      credentials={credentials}
      auditLogs={auditLogs}
      currentUserName={currentUser?.name || ''}
      onAddCredential={handleAddCredential}
      onUpdateCredential={handleUpdateCredential}
      onDeleteCredential={handleDeleteCredential}
      onLogAudit={handleLogAudit}
    />
  );
}
