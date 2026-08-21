import { useLocation } from 'react-router-dom';
import DocVault from '../components/DocVault';
import { useAppData } from '../context/AppDataContext';

export default function DocsPage() {
  const {
    documents,
    currentUser,
    handleAddDocument,
    handleEditDocument,
    handleDeleteDocument,
    handleMoveDocument,
    docCurrentFolderId,
    setDocCurrentFolderId
  } = useAppData();
  const location = useLocation();
  const docId = (location.state as { docId?: string } | null)?.docId;

  return (
    <DocVault
      documents={documents}
      currentUserName={currentUser?.name || ''}
      onAddDocument={handleAddDocument}
      onEditDocument={handleEditDocument}
      onDeleteDocument={handleDeleteDocument}
      onMoveDocument={handleMoveDocument}
      currentFolderId={docCurrentFolderId}
      setCurrentFolderId={setDocCurrentFolderId}
      initialSelectedDocId={docId}
    />
  );
}
