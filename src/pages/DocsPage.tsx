import { useLocation } from 'react-router-dom';
import DocVault from '../components/DocVault';
import { useAppData } from '../context/AppDataContext';

export default function DocsPage() {
  const { documents, handleAddDocument, handleUpdateDocumentVersion } = useAppData();
  const location = useLocation();
  const docId = (location.state as { docId?: string } | null)?.docId;

  return (
    <DocVault
      documents={documents}
      onAddDocument={handleAddDocument}
      onUpdateDocumentVersion={handleUpdateDocumentVersion}
      initialSelectedDocId={docId}
    />
  );
}
