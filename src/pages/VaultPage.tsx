import CredentialVault from '../components/CredentialVault';
import { useAppData } from '../context/AppDataContext';

export default function VaultPage() {
  const { credentials, currentUser, projects, handleAddCredential, handleUpdateCredential, handleDeleteCredential, handleLogAudit } = useAppData();
  return (
    <CredentialVault
      credentials={credentials}
      currentUserName={currentUser?.name || ''}
      currentUserDepartment={currentUser?.department}
      projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      onAddCredential={handleAddCredential}
      onUpdateCredential={handleUpdateCredential}
      onDeleteCredential={handleDeleteCredential}
      onLogAudit={handleLogAudit}
    />
  );
}
