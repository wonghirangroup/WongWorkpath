import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LinkedDoc, Department } from '../types';
import {
  Plus,
  Copy,
  ExternalLink,
  Link2,
  Check,
  Folder,
  FolderPlus,
  Upload,
  File as FileIcon,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Monitor,
  Archive,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  LayoutGrid,
  List,
  MoreHorizontal,
  X
} from 'lucide-react';
import Dropdown from './Dropdown';
import firstCreateDocIcon from '../../images/frist create doc icon.png';
import searchIcon from '../../images/icon/Search pass.png';
import editIcon from '../../images/icon menu/edit.png';
import deleteIcon from '../../images/icon menu/delete.png';

interface DocVaultProps {
  documents: LinkedDoc[];
  currentUserName: string;
  onAddDocument: (doc: LinkedDoc) => void;
  onEditDocument: (docId: string, updates: { name: string; url?: string; scope: LinkedDoc['scope']; team?: Department }) => void;
  onDeleteDocument: (docId: string) => void;
  onMoveDocument: (docId: string, newParentId: string) => void;
  // Lifted to AppDataContext (not local state) so AppLayout can render the current folder as a
  // breadcrumb title in the shared Header, and navigate it from there too.
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  initialSelectedDocId?: string;
}

const KIND_FILTER_OPTIONS: { value: LinkedDoc['kind'] | 'All'; label: string }[] = [
  { value: 'All', label: 'ไฟล์ทั้งหมด' },
  { value: 'folder', label: 'โฟลเดอร์' },
  { value: 'file', label: 'ไฟล์' },
  { value: 'link', label: 'ลิงก์' }
];

const SORT_OPTIONS: { value: 'latest' | 'oldest' | 'az'; label: string }[] = [
  { value: 'latest', label: 'ล่าสุด' },
  { value: 'oldest', label: 'เก่าสุด' },
  { value: 'az', label: 'ชื่อ A-Z' }
];

const SCOPE_FILTER_OPTIONS: { value: LinkedDoc['scope'] | '__all__'; label: string }[] = [
  { value: '__all__', label: 'รายการทั้งหมด' },
  { value: 'ส่วนตัว', label: 'ส่วนตัว' },
  { value: 'ทีม', label: 'ทีม' }
];

const TEAM_OPTIONS: Department[] = ['IT', 'HR', 'Marketing', 'Sales', 'Design', 'Finance'];

const DEPARTMENT_TAG_COLORS: Record<Department, string> = {
  IT: 'text-blue-700 bg-blue-100',
  HR: 'text-fuchsia-700 bg-fuchsia-100',
  Marketing: 'text-orange-700 bg-orange-100',
  Sales: 'text-emerald-700 bg-emerald-100',
  Design: 'text-purple-700 bg-purple-100',
  Finance: 'text-slate-700 bg-slate-200'
};

const getDeptTagClass = (team?: Department) => (team ? DEPARTMENT_TAG_COLORS[team] : 'text-[#FF6537] bg-[#FFF1EC]');

// 3MB raw-file cap — base64 inflates ~33% on top of that, and everything shares one
// browser-wide localStorage budget (~5-10MB) with tasks/credentials/audit logs etc.
const MAX_FILE_BYTES = 3 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Suggests a starting name from a pasted URL so the field isn't blank — still editable.
function suggestLinkName(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname.includes('docs.google.com') && pathname.includes('/spreadsheets')) return 'ชีตข้อมูล Google Sheets';
    if (hostname.includes('docs.google.com') && pathname.includes('/presentation')) return 'งานนำเสนอ Google Slides';
    if (hostname.includes('docs.google.com') && pathname.includes('/document')) return 'เอกสาร Google Docs';
    if (hostname.includes('figma.com')) return 'ไฟล์ Figma';
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function readFileAsDataUrl(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Formats "2026-06-22 11:15" as the Thai short date "22/6/2569" (Buddhist Era year)
function formatThaiShortDate(dateStr: string) {
  const [datePart] = dateStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  return `${day}/${month}/${year + 543}`;
}

// Per-card "..." menu — portals to document.body (positioned from the trigger button's own rect)
// so it floats above the page instead of getting clipped by the table's horizontal-scroll wrapper.
// Each action is only rendered when its handler is supplied, so folder/file/link cards each show
// only the actions that make sense for that kind.
function DocCardMenu({ onOpenFolder, onEdit, onOpenFile, onCopyLink, onDelete, copied }: {
  onOpenFolder?: () => void;
  onEdit?: () => void;
  onOpenFile?: () => void;
  onCopyLink?: () => void;
  onDelete: () => void;
  copied?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setIsOpen(true);
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        className="p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
        title="ตัวเลือกเพิ่มเติม"
      >
        <MoreHorizontal size={18} className="text-slate-500" />
      </button>
      {createPortal(
        <AnimatePresence>
          {isOpen && menuPos && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
              className="w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50"
            >
              {onOpenFolder && (
                <button
                  onClick={() => { setIsOpen(false); onOpenFolder(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Folder size={15} /> เปิดโฟลเดอร์
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => { setIsOpen(false); onEdit(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <img src={editIcon} alt="" className="w-4 h-4" /> แก้ไข
                </button>
              )}
              {onOpenFile && (
                <button
                  onClick={() => { setIsOpen(false); onOpenFile(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <ExternalLink size={15} /> เปิด/ดาวน์โหลด
                </button>
              )}
              {onCopyLink && (
                <button
                  onClick={() => { setIsOpen(false); onCopyLink(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />} คัดลอกลิงก์
                </button>
              )}
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => { setIsOpen(false); onDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <img src={deleteIcon} alt="" className="w-4 h-4" /> ลบ
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function getFileExtension(name: string): string {
  const match = name.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : '';
}

// Small icon + accent color per item, shared by grid cards and list rows — for files, matches
// the actual extension/mime type (PDF, image, Word, Excel, ...) rather than one generic icon,
// so the card gives a real hint of what's inside before you open it.
function getItemVisual(doc: LinkedDoc) {
  if (doc.kind === 'folder') return { Icon: Folder, color: 'text-[#FF6537]', fill: true, isPdf: false, isImage: false };
  if (doc.kind === 'link') return { Icon: Link2, color: 'text-emerald-600', fill: false, isPdf: false, isImage: false };

  const mime = doc.fileMimeType || '';
  const ext = getFileExtension(doc.name);
  const isPdf = mime === 'application/pdf' || ext === 'pdf';
  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const isWord = mime.includes('word') || ['doc', 'docx'].includes(ext);
  const isExcel = mime.includes('sheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext);
  const isPpt = mime.includes('presentation') || ['ppt', 'pptx'].includes(ext);
  const isArchive = mime.includes('zip') || mime.includes('compressed') || ['zip', 'rar', '7z'].includes(ext);

  if (isPdf) return { Icon: FileText, color: 'text-red-500', fill: false, isPdf: true, isImage: false };
  if (isImage) return { Icon: ImageIcon, color: 'text-purple-500', fill: false, isPdf: false, isImage: true };
  if (isWord) return { Icon: FileText, color: 'text-blue-600', fill: false, isPdf: false, isImage: false };
  if (isExcel) return { Icon: FileSpreadsheet, color: 'text-emerald-600', fill: false, isPdf: false, isImage: false };
  if (isPpt) return { Icon: Monitor, color: 'text-orange-500', fill: false, isPdf: false, isImage: false };
  if (isArchive) return { Icon: Archive, color: 'text-amber-600', fill: false, isPdf: false, isImage: false };
  return { Icon: FileIcon, color: 'text-blue-500', fill: false, isPdf: false, isImage: false };
}

export default function DocVault({
  documents,
  currentUserName,
  onAddDocument,
  onEditDocument,
  onDeleteDocument,
  onMoveDocument,
  currentFolderId,
  setCurrentFolderId,
  initialSelectedDocId
}: DocVaultProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKind, setSelectedKind] = useState<LinkedDoc['kind'] | 'All'>('All');
  const [scopeFilter, setScopeFilter] = useState<LinkedDoc['scope'] | '__all__'>('__all__');
  const [teamFilter, setTeamFilter] = useState<Department | '__all__'>('__all__');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'az'>('latest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const goToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearchTerm('');
  };

  // Drag-and-drop: any item can be dragged onto a folder card/row to move it inside that folder.
  // dragOverFolderId only drives the drop-target highlight; the actual cycle/no-op guard lives
  // in AppDataContext's handleMoveDocument.
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, doc: LinkedDoc) => {
    setDraggedDocId(doc.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', doc.id);
  };

  const handleDragEnd = () => {
    setDraggedDocId(null);
    setDragOverFolderId(null);
  };

  const isValidDropTarget = (folder: LinkedDoc) =>
    folder.kind === 'folder' && !!draggedDocId && draggedDocId !== folder.id;

  const handleFolderDragOver = (e: React.DragEvent, folder: LinkedDoc) => {
    const isOsFileDrag = e.dataTransfer.types.includes('Files');
    if (!isOsFileDrag && !isValidDropTarget(folder)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = isOsFileDrag ? 'copy' : 'move';
    setDragOverFolderId(folder.id);
  };

  const handleFolderDragLeave = (folder: LinkedDoc) => {
    setDragOverFolderId((prev) => (prev === folder.id ? null : prev));
  };

  const handleFolderDrop = (e: React.DragEvent, folder: LinkedDoc) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    if (e.dataTransfer.types.includes('Files') && e.dataTransfer.files.length > 0) {
      uploadFilesToFolder(Array.from(e.dataTransfer.files), folder.id);
      return;
    }
    if (draggedDocId && isValidDropTarget(folder)) onMoveDocument(draggedDocId, folder.id);
    setDraggedDocId(null);
  };

  // Native OS drag-and-drop (files dragged in from Windows File Explorer etc.) — separate from
  // the internal item-move drag above, distinguished via dataTransfer.types including 'Files'.
  // A dragenter/dragleave counter is needed (not a plain boolean) since those events fire on
  // every child element the cursor crosses, not just the wrapper itself.
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [dropUploadError, setDropUploadError] = useState('');
  const fileDragCounter = useRef(0);

  const uploadFilesToFolder = async (files: globalThis.File[], targetFolderId: string | null) => {
    const oversized: string[] = [];
    const valid = files.filter((file) => {
      if (file.size > MAX_FILE_BYTES) {
        oversized.push(file.name);
        return false;
      }
      return true;
    });

    // Dropped files inherit the target folder's scope/team, same as files added through the
    // create modal — the folder already establishes "this is a team/personal space".
    const targetFolder = documents.find(d => d.id === targetFolderId);
    const scope: LinkedDoc['scope'] = targetFolderId ? (targetFolder?.scope ?? 'ส่วนตัว') : 'ส่วนตัว';
    const team = targetFolderId ? targetFolder?.team : undefined;
    if (targetFolderId === currentFolderId) {
      setScopeFilter(scope);
      setTeamFilter(team || '__all__');
    }

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      const dataUrl = await readFileAsDataUrl(file);
      const date = nowStamp();
      const newDoc: LinkedDoc = {
        id: `DOC${Date.now()}${i}`,
        name: file.name.replace(/\.[^.]+$/, '') || file.name,
        kind: 'file',
        parentId: targetFolderId,
        fileDataUrl: dataUrl,
        fileMimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        scope,
        team,
        version: 1,
        lastUpdated: date,
        updatedBy: currentUserName,
        history: [{ version: 1, updatedBy: currentUserName, date, note: 'อัปโหลดไฟล์ครั้งแรก' }]
      };
      onAddDocument(newDoc);
    }

    if (oversized.length > 0) {
      setDropUploadError(`ไฟล์ใหญ่เกิน ${formatFileSize(MAX_FILE_BYTES)} ถูกข้าม: ${oversized.join(', ')}`);
      setTimeout(() => setDropUploadError(''), 5000);
    } else if (valid.length > 0) {
      setAddSuccessNotice(true);
      setTimeout(() => setAddSuccessNotice(false), 3000);
    }
  };

  const handleWorkspaceDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    fileDragCounter.current += 1;
    setIsFileDragActive(true);
  };

  const handleWorkspaceDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleWorkspaceDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    fileDragCounter.current = Math.max(0, fileDragCounter.current - 1);
    if (fileDragCounter.current === 0) setIsFileDragActive(false);
  };

  const handleWorkspaceDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    fileDragCounter.current = 0;
    setIsFileDragActive(false);
    if (e.dataTransfer.files.length > 0) uploadFilesToFolder(Array.from(e.dataTransfer.files), currentFolderId);
  };

  // Quick state to notify link copy
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // "+ เพิ่มใหม่" split button — choosing an option opens the matching lightweight form below the toolbar
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMode, setAddMode] = useState<'folder' | 'file' | 'link' | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newScope, setNewScope] = useState<LinkedDoc['scope']>('ส่วนตัว');
  const [newTeam, setNewTeam] = useState<Department | ''>('');
  const [nameTouched, setNameTouched] = useState(false);
  const [pickedFile, setPickedFile] = useState<globalThis.File | null>(null);
  const [fileError, setFileError] = useState('');
  const [isSubmittingFile, setIsSubmittingFile] = useState(false);
  const [addSuccessNotice, setAddSuccessNotice] = useState(false);

  // Edit modal — rename a folder/file, or rename + change the URL of a link
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editScope, setEditScope] = useState<LinkedDoc['scope']>('ส่วนตัว');
  const [editTeam, setEditTeam] = useState<Department | ''>('');
  const [editSuccessNotice, setEditSuccessNotice] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; hasChildren: boolean } | null>(null);

  // Preview modal — real in-browser rendering for PDFs (printable) and images, with an
  // open/download fallback for other file types. Also what a deep-linked doc opens into.
  const [previewDocId, setPreviewDocId] = useState<string | null>(initialSelectedDocId || null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const previewDoc = documents.find(d => d.id === previewDocId);

  // Image zoom in the preview modal — scales up from the "fit to modal" size (1x); the
  // container switches to scrollable so a zoomed-in image can be panned via scroll/trackpad.
  // Steps stay gentle (small increments) so the subject grows without pushing key content
  // out of frame — a "slight zoom" rather than a hard crop.
  const ZOOM_STEPS = [1, 1.15, 1.3, 1.5];
  const [zoomLevel, setZoomLevel] = useState(1);
  useEffect(() => { setZoomLevel(1); }, [previewDocId]);
  const zoomIn = () => setZoomLevel((z) => ZOOM_STEPS[Math.min(ZOOM_STEPS.indexOf(z) + 1, ZOOM_STEPS.length - 1)]);
  const zoomOut = () => setZoomLevel((z) => ZOOM_STEPS[Math.max(ZOOM_STEPS.indexOf(z) - 1, 0)]);

  useEffect(() => {
    if (!isSortOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setIsSortOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSortOpen]);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [addMenuOpen]);

  const closeAddForm = () => {
    setAddMode(null);
    setNewName('');
    setNewUrl('');
    setNewNote('');
    setNewScope('ส่วนตัว');
    setNewTeam('');
    setNameTouched(false);
    setPickedFile(null);
    setFileError('');
  };

  const openAddMode = (mode: 'folder' | 'file' | 'link') => {
    closeAddForm();
    setAddMode(mode);
    setAddMenuOpen(false);
  };

  const editDoc = documents.find(d => d.id === editDocId);

  const closeEdit = () => {
    setEditDocId(null);
    setEditName('');
    setEditUrl('');
    setEditScope('ส่วนตัว');
    setEditTeam('');
  };

  const openEdit = (doc: LinkedDoc) => {
    setEditDocId(doc.id);
    setEditName(doc.name);
    setEditUrl(doc.url || '');
    setEditScope(doc.scope);
    setEditTeam(doc.team || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDocId || !editName.trim()) return;
    onEditDocument(editDocId, {
      name: editName.trim(),
      ...(editDoc?.kind === 'link' ? { url: editUrl.trim() } : {}),
      scope: editScope,
      team: editScope === 'ทีม' ? (editTeam || undefined) : undefined
    });
    closeEdit();
    setEditSuccessNotice(true);
    setTimeout(() => setEditSuccessNotice(false), 3000);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDeleteDocument(deleteTarget.id);
    if (editDocId === deleteTarget.id) closeEdit();
    if (previewDocId === deleteTarget.id) setPreviewDocId(null);
    if (currentFolderId === deleteTarget.id) goToFolder(null);
    setDeleteTarget(null);
  };

  const askDelete = (doc: LinkedDoc) => {
    const hasChildren = doc.kind === 'folder' && documents.some(d => d.parentId === doc.id);
    setDeleteTarget({ id: doc.id, name: doc.name, hasChildren });
  };

  // Double-click to open: folders navigate in, links jump straight to a new tab, everything
  // else opens the preview modal (renaming/editing lives only in the "..." menu via openEdit).
  const openDoc = (doc: LinkedDoc) => {
    if (doc.kind === 'folder') return goToFolder(doc.id);
    if (doc.kind === 'link') {
      if (doc.url) window.open(doc.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setPreviewDocId(doc.id);
  };

  // The open folder itself (if any) — items created inside it inherit its scope/team rather
  // than asking again, since the folder already established "this is a team/personal space".
  const currentFolder = documents.find(d => d.id === currentFolderId);
  const resolveCreateScope = (): { scope: LinkedDoc['scope']; team?: Department } =>
    currentFolderId
      ? { scope: currentFolder?.scope ?? 'ส่วนตัว', team: currentFolder?.team }
      : { scope: newScope, team: newScope === 'ทีม' ? (newTeam || undefined) : undefined };

  // Items inside the current folder, then search + kind filter on top of that
  const itemsHere = documents.filter(doc => doc.parentId === currentFolderId);
  const filteredDocs = itemsHere.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesKind = selectedKind === 'All' || doc.kind === selectedKind;
    const matchesScope = scopeFilter === '__all__' || doc.scope === scopeFilter;
    const matchesTeam = scopeFilter !== 'ทีม' || teamFilter === '__all__' || doc.team === teamFilter;
    return matchesSearch && matchesKind && matchesScope && matchesTeam;
  });

  const sortedDocs = [...filteredDocs].sort((a, b) => {
    // Folders always float to the top, like a real file browser — the chosen sort only orders within each group
    if (a.kind === 'folder' && b.kind !== 'folder') return -1;
    if (a.kind !== 'folder' && b.kind === 'folder') return 1;
    if (sortBy === 'az') return a.name.localeCompare(b.name, 'th');
    const diff = new Date(b.lastUpdated.replace(' ', 'T')).getTime() - new Date(a.lastUpdated.replace(' ', 'T')).getTime();
    return sortBy === 'latest' ? diff : -diff;
  });

  const nowStamp = () => new Date().toISOString().replace('T', ' ').substring(0, 16);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const date = nowStamp();
    const { scope, team } = resolveCreateScope();
    const newDoc: LinkedDoc = {
      id: 'DOC' + Date.now(),
      name: newName.trim(),
      kind: 'folder',
      parentId: currentFolderId,
      scope,
      team,
      version: 1,
      lastUpdated: date,
      updatedBy: currentUserName,
      history: [{ version: 1, updatedBy: currentUserName, date, note: 'สร้างโฟลเดอร์' }]
    };
    onAddDocument(newDoc);
    setScopeFilter(scope);
    setTeamFilter(team || '__all__');
    closeAddForm();
    setAddSuccessNotice(true);
    setTimeout(() => setAddSuccessNotice(false), 3000);
  };

  const handleFilePicked = (file: globalThis.File | null) => {
    setFileError('');
    if (file && file.size > MAX_FILE_BYTES) {
      setFileError(`ไฟล์ใหญ่เกินไป (${formatFileSize(file.size)}) — อัปโหลดได้ไม่เกิน ${formatFileSize(MAX_FILE_BYTES)}`);
      setPickedFile(null);
      return;
    }
    setPickedFile(file);
    if (file && !nameTouched) {
      setNewName(file.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !pickedFile) return;
    setIsSubmittingFile(true);
    try {
      const dataUrl = await readFileAsDataUrl(pickedFile);
      const date = nowStamp();
      const { scope, team } = resolveCreateScope();
      const newDoc: LinkedDoc = {
        id: 'DOC' + Date.now(),
        name: newName.trim(),
        kind: 'file',
        parentId: currentFolderId,
        fileDataUrl: dataUrl,
        fileMimeType: pickedFile.type || 'application/octet-stream',
        fileSize: pickedFile.size,
        scope,
        team,
        version: 1,
        lastUpdated: date,
        updatedBy: currentUserName,
        history: [{ version: 1, updatedBy: currentUserName, date, note: newNote.trim() || 'อัปโหลดไฟล์ครั้งแรก' }]
      };
      onAddDocument(newDoc);
      setScopeFilter(scope);
      setTeamFilter(team || '__all__');
      closeAddForm();
      setAddSuccessNotice(true);
      setTimeout(() => setAddSuccessNotice(false), 3000);
    } finally {
      setIsSubmittingFile(false);
    }
  };

  const handleAttachLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    const date = nowStamp();
    const { scope, team } = resolveCreateScope();
    const newDoc: LinkedDoc = {
      id: 'DOC' + Date.now(),
      name: newName.trim(),
      kind: 'link',
      parentId: currentFolderId,
      url: newUrl.trim(),
      scope,
      team,
      version: 1,
      lastUpdated: date,
      updatedBy: currentUserName,
      history: [{ version: 1, updatedBy: currentUserName, date, note: newNote.trim() || 'แนบลิงก์ครั้งแรก' }]
    };
    onAddDocument(newDoc);
    setScopeFilter(scope);
    setTeamFilter(team || '__all__');
    closeAddForm();
    setAddSuccessNotice(true);
    setTimeout(() => setAddSuccessNotice(false), 3000);
  };

  const handleUrlChange = (value: string) => {
    setNewUrl(value);
    if (!nameTouched) setNewName(value.trim() ? suggestLinkName(value) : '');
  };

  const copyToClipboard = (url: string, docId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(docId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openFile = (doc: LinkedDoc) => {
    if (!doc.fileDataUrl) return;
    const a = document.createElement('a');
    a.href = doc.fileDataUrl;
    a.download = doc.name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  return (
    <div
      className="space-y-6 relative"
      id="doc-vault-tab"
      onDragEnter={handleWorkspaceDragEnter}
      onDragOver={handleWorkspaceDragOver}
      onDragLeave={handleWorkspaceDragLeave}
      onDrop={handleWorkspaceDrop}
    >
      {isFileDragActive && (
        <div className="fixed inset-0 z-40 bg-white/80 backdrop-blur-[1px] pointer-events-none flex items-center justify-center">
          <div className="border-2 border-dashed border-[#FF6537] rounded-2xl bg-[#FFF8F5] px-12 py-10 flex flex-col items-center gap-2">
            <Upload size={32} className="text-[#FF6537]" />
            <p className="text-sm font-bold text-[#272220]">วางไฟล์ที่นี่เพื่ออัปโหลด</p>
            <p className="text-xs text-[#6F6F6F]">ไฟล์จะถูกเพิ่มใน{currentFolderId ? 'โฟลเดอร์นี้' : 'เอกสาร Drive'}</p>
          </div>
        </div>
      )}

      {dropUploadError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg max-w-lg text-center">
          {dropUploadError}
        </div>
      )}

      {documents.length === 0 ? (
        /* Nothing linked yet — big centered empty state, no search/filter controls */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <img src={firstCreateDocIcon} alt="" className="w-62.5 h-62.5 object-contain" />
          <p className="text-sm text-[#6F6F6F] -mt-12 mb-6">ยังไม่มีเอกสารในระบบ เริ่มต้นสร้างรายการแรกได้เลย</p>
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setAddMenuOpen((prev) => !prev)}
              className="bg-[#FF6537] hover:opacity-90 text-white text-sm font-bold px-6 h-11 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} /> สร้างเอกสาร
              <ChevronDown size={14} className={`transition-transform duration-150 ease-out ${addMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {addMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 origin-top text-left"
                >
                  <button onClick={() => openAddMode('folder')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <FolderPlus size={15} className="text-[#FF6537]" /> สร้างโฟลเดอร์
                  </button>
                  <button onClick={() => openAddMode('file')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <Upload size={15} className="text-blue-500" /> อัปโหลดไฟล์
                  </button>
                  <button onClick={() => openAddMode('link')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <Link2 size={15} className="text-emerald-600" /> แนบลิงก์
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
      <>

      {/* Search, view toggle, kind filter & create — single controls row, same layout as the Credential Vault */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative w-full lg:w-137.5 lg:flex-none">
          <img src={searchIcon} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 mt-px w-3.5 h-5 object-contain" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาในโฟลเดอร์นี้ (ชื่อ)"
            className="w-full h-10 pl-9 pr-9 bg-[#F6F6F8] border border-transparent rounded-xl text-[13px] font-normal focus:outline-none focus:border-[#FF6537]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="ล้างคำค้นหา"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Grid / list view toggle */}
          <div className="flex items-center gap-0.5 bg-[#F4F4F5] rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#272220]' : 'text-[#6F6F6F] hover:text-[#272220]'}`}
              title="มุมมองตาราง"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-[#272220]' : 'text-[#6F6F6F] hover:text-[#272220]'}`}
              title="มุมมองรายการ"
            >
              <List size={15} />
            </button>
          </div>

          <div className="w-27.5 h-10">
            <Dropdown<LinkedDoc['kind'] | 'All'>
              value={selectedKind}
              onChange={setSelectedKind}
              options={KIND_FILTER_OPTIONS}
            />
          </div>

          <div className="w-36 h-10">
            <Dropdown<LinkedDoc['scope'] | '__all__'>
              value={scopeFilter}
              onChange={(value) => { setScopeFilter(value); setTeamFilter('__all__'); }}
              options={SCOPE_FILTER_OPTIONS}
            />
          </div>

          {scopeFilter === 'ทีม' && (
            <div className="w-33.75 h-10">
              <Dropdown<Department | '__all__'>
                value={teamFilter}
                onChange={setTeamFilter}
                options={[
                  { value: '__all__', label: 'ทุกทีม' },
                  ...TEAM_OPTIONS.map((team) => ({ value: team, label: team }))
                ]}
              />
            </div>
          )}

          {/* "+" split button — opens a 3-way menu: folder / file upload / link */}
          <div className="relative lg:ml-auto shrink-0" ref={addMenuRef}>
            <button
              onClick={() => setAddMenuOpen((prev) => !prev)}
              className="bg-[#FF6537] hover:opacity-90 text-white text-sm font-bold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus size={16} /> เพิ่มเอกสารใหม่
              <ChevronDown size={14} className={`transition-transform duration-150 ease-out ${addMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {addMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 origin-top-right"
                >
                  <button onClick={() => openAddMode('folder')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <FolderPlus size={15} className="text-[#FF6537]" /> สร้างโฟลเดอร์
                  </button>
                  <button onClick={() => openAddMode('file')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <Upload size={15} className="text-blue-500" /> อัปโหลดไฟล์
                  </button>
                  <button onClick={() => openAddMode('link')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <Link2 size={15} className="text-emerald-600" /> แนบลิงก์
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Result count + sort */}
      <div className="flex items-center gap-2">
        <p className="font-normal text-[16px] text-[#6F6F6F] leading-none">ทั้งหมด {filteredDocs.length} รายการ</p>
        <div className="relative" ref={sortRef}>
          <button
            type="button"
            onClick={() => setIsSortOpen((prev) => !prev)}
            className="flex items-center gap-2 cursor-pointer"
            title="เรียงตาม"
          >
            <span className="text-sm text-[#6F6F6F] leading-none mt-1">•</span>
            <span className="text-sm text-[#6F6F6F] leading-none mt-0.5">
              เรียงตาม: {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
            </span>
            <ChevronDown
              size={14}
              className={`text-[#272220] transition-transform duration-150 ease-out ${isSortOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {isSortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-20"
              >
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => { setSortBy(option.value); setIsSortOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 text-sm cursor-pointer ${
                      option.value === sortBy
                        ? 'bg-[#FF6537] text-white font-semibold'
                        : 'text-slate-800 hover:bg-[#FEFAF9]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Document list — grid of folder/file/link cards, or a compact table */}
      {viewMode === 'list' ? (
        sortedDocs.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
            {itemsHere.length === 0 ? 'โฟลเดอร์นี้ว่างเปล่า' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9F9F9] text-[12px] font-semibold text-[#000000] border-b border-[#EDEEEF]">
                  <th className="px-4 py-3 whitespace-nowrap">ชื่อ</th>
                  <th className="px-4 py-3 whitespace-nowrap">สร้างโดย</th>
                  <th className="px-4 py-3 whitespace-nowrap">สร้างเมื่อ</th>
                  <th className="px-4 py-3 whitespace-nowrap">การกระทำ</th>
                </tr>
              </thead>
              <tbody>
                {sortedDocs.map((doc) => {
                  const creation = doc.history[0];
                  const creatorName = creation?.updatedBy ?? doc.updatedBy;
                  const createdDate = creation?.date ?? doc.lastUpdated;
                  const { Icon, color, fill, isPdf, isImage } = getItemVisual(doc);

                  return (
                    <tr
                      key={doc.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, doc)}
                      onDragEnd={handleDragEnd}
                      onDragOver={doc.kind === 'folder' ? (e) => handleFolderDragOver(e, doc) : undefined}
                      onDragLeave={doc.kind === 'folder' ? () => handleFolderDragLeave(doc) : undefined}
                      onDrop={doc.kind === 'folder' ? (e) => handleFolderDrop(e, doc) : undefined}
                      onDoubleClick={() => openDoc(doc)}
                      className={`bg-white border-b border-[#EDEEEF] last:border-b-0 hover:bg-slate-50 cursor-pointer select-none ${
                        draggedDocId === doc.id ? 'opacity-40' : ''
                      } ${dragOverFolderId === doc.id ? 'bg-orange-50 outline outline-2 outline-[#FF6537] -outline-offset-2' : ''}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Icon size={22} className={`${color} shrink-0`} fill={fill ? 'currentColor' : 'none'} strokeWidth={fill ? 1 : 1.75} />
                          <p className="text-[13px] font-bold text-slate-900 leading-tight">{doc.name}</p>
                          {doc.scope === 'ทีม' && (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none shrink-0 ${getDeptTagClass(doc.team)}`}>
                              {doc.team || 'ทีม'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">
                        {creatorName === currentUserName ? 'คุณ' : creatorName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] font-normal text-[#6F6F6F]">
                        {formatThaiShortDate(createdDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(doc); }}
                            onDoubleClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="แก้ไข"
                          >
                            <img src={editIcon} alt="" className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); askDelete(doc); }}
                            onDoubleClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="ลบ"
                          >
                            <img src={deleteIcon} alt="" className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sortedDocs.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm col-span-full">
              {itemsHere.length === 0 ? 'โฟลเดอร์นี้ว่างเปล่า' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
            </div>
          ) : (
            sortedDocs.map((doc) => {
              const creation = doc.history[0];
              const creatorName = creation?.updatedBy ?? doc.updatedBy;
              const createdDate = creation?.date ?? doc.lastUpdated;
              const { Icon, color, fill, isPdf, isImage } = getItemVisual(doc);

              const cardMenu = (
                <DocCardMenu
                  onOpenFolder={doc.kind === 'folder' ? () => goToFolder(doc.id) : undefined}
                  onEdit={() => openEdit(doc)}
                  onOpenFile={doc.kind === 'file' ? () => openFile(doc) : undefined}
                  onCopyLink={doc.kind === 'link' && doc.url ? () => copyToClipboard(doc.url!, doc.id) : undefined}
                  onDelete={() => askDelete(doc)}
                  copied={copiedId === doc.id}
                />
              );
              const footer = (
                <div className="flex justify-between items-center text-[11px] font-normal text-[#6F6F6F] pt-2 border-t border-[#EDEEEF]">
                  <span>สร้างโดย: {creatorName === currentUserName ? 'คุณ' : creatorName}</span>
                  <span>สร้างเมื่อ: {formatThaiShortDate(createdDate)}</span>
                </div>
              );

              return (
                <div
                  key={doc.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, doc)}
                  onDragEnd={handleDragEnd}
                  onDragOver={doc.kind === 'folder' ? (e) => handleFolderDragOver(e, doc) : undefined}
                  onDragLeave={doc.kind === 'folder' ? () => handleFolderDragLeave(doc) : undefined}
                  onDrop={doc.kind === 'folder' ? (e) => handleFolderDrop(e, doc) : undefined}
                  onDoubleClick={() => openDoc(doc)}
                  className={`h-64 bg-white shadow-[0px_2px_7px_-1px_rgba(0,0,0,0.1)] p-4 rounded-2xl space-y-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-pointer flex flex-col select-none ${
                    draggedDocId === doc.id ? 'opacity-40' : ''
                  } ${dragOverFolderId === doc.id ? 'bg-orange-50 outline outline-2 outline-[#FF6537] -outline-offset-2' : ''}`}
                >
                  {doc.kind === 'folder' ? (
                    <>
                      <div className="flex justify-end -mr-1.5 -mt-1.5">
                        {cardMenu}
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5">
                        <Icon size={56} className={color} fill={fill ? 'currentColor' : 'none'} strokeWidth={fill ? 1 : 1.25} />
                        <h4 className="text-[15px] font-bold text-[#272220] truncate max-w-full w-full">{doc.name}</h4>
                        {doc.scope === 'ทีม' && (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${getDeptTagClass(doc.team)}`}>
                            {doc.team || 'ทีม'}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon size={18} className={`${color} shrink-0`} fill={fill ? 'currentColor' : 'none'} strokeWidth={fill ? 1.5 : 1.75} />
                          <h4 className="text-[15px] font-bold text-[#272220] truncate">{doc.name}</h4>
                          {doc.scope === 'ทีม' && (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none shrink-0 ${getDeptTagClass(doc.team)}`}>
                              {doc.team || 'ทีม'}
                            </span>
                          )}
                        </div>
                        {cardMenu}
                      </div>
                      <div className="flex-1 bg-white border border-slate-100 rounded-xl flex items-center justify-center overflow-hidden">
                        {isImage && doc.fileDataUrl ? (
                          <img src={doc.fileDataUrl} alt="" className="max-w-full max-h-full object-contain" />
                        ) : isPdf && doc.fileDataUrl ? (
                          // The browser's built-in PDF viewer always draws its own scrollbar
                          // regardless of URL params, so the iframe is made wider than its
                          // clipped wrapper and pinned to the left — the scrollbar renders past
                          // the right edge, into the overflow-hidden area, out of sight.
                          <div className="w-full h-full overflow-hidden relative">
                            <iframe
                              src={`${doc.fileDataUrl}#toolbar=0&navpanes=0&view=FitH`}
                              title={doc.name}
                              className="absolute top-0 left-0 h-full pointer-events-none"
                              style={{ width: 'calc(100% + 20px)' }}
                            />
                          </div>
                        ) : (
                          <Icon size={56} className={color} fill={fill ? 'currentColor' : 'none'} strokeWidth={fill ? 1 : 1.25} />
                        )}
                      </div>
                    </>
                  )}
                  {footer}
                </div>
              );
            })
          )}
        </div>
      )}

      </>
      )}

      {/* Create modal — folder / file-upload / link, whichever "+" option was picked */}
      {createPortal(
        <AnimatePresence>
          {addMode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={closeAddForm}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">
                    {addMode === 'folder' ? 'สร้างโฟลเดอร์ใหม่' : addMode === 'file' ? 'อัปโหลดไฟล์' : 'แนบลิงก์เอกสาร Google Workspace, Figma หรือไฟล์อื่นๆ'}
                  </h3>
                  <button type="button" onClick={closeAddForm} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                {addMode === 'folder' && (
                  <form onSubmit={handleCreateFolder} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อโฟลเดอร์ *</label>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="เช่น เอกสารฝ่ายการตลาด"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    {!currentFolderId ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">ประเภทสิทธิ์</label>
                          <Dropdown<LinkedDoc['scope']>
                            value={newScope}
                            onChange={setNewScope}
                            size="compact"
                            options={[
                              { value: 'ส่วนตัว', label: 'ส่วนตัว' },
                              { value: 'ทีม', label: 'ทีม' }
                            ]}
                          />
                        </div>
                        {newScope === 'ทีม' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">เลือกทีม</label>
                            <Dropdown<Department | '__unset__'>
                              value={newTeam || '__unset__'}
                              onChange={(value) => setNewTeam(value === '__unset__' ? '' : value)}
                              placeholder="ไม่ระบุทีม"
                              size="compact"
                              options={[
                                { value: '__unset__', label: 'ไม่ระบุทีม' },
                                ...TEAM_OPTIONS.map((team) => ({ value: team, label: team }))
                              ]}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2">
                        <span>สิทธิ์:</span>
                        <span className={`font-semibold px-1.5 py-0.5 rounded-full text-[10px] ${currentFolder?.scope === 'ทีม' ? getDeptTagClass(currentFolder?.team) : 'text-slate-600 bg-slate-200'}`}>
                          {currentFolder?.scope === 'ทีม' ? (currentFolder?.team || 'ทีม') : 'ส่วนตัว'}
                        </span>
                        <span className="text-slate-400">(สืบทอดจากโฟลเดอร์นี้)</span>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={closeAddForm} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                      <button
                        type="submit"
                        disabled={!newName.trim()}
                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${newName.trim() ? 'bg-[#FF6537] text-white hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] text-white cursor-not-allowed'}`}
                      >
                        สร้างโฟลเดอร์
                      </button>
                    </div>
                  </form>
                )}

                {addMode === 'file' && (
                  <form onSubmit={handleUploadFile} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">เลือกไฟล์ * <span className="font-normal text-slate-400">(ไม่เกิน {formatFileSize(MAX_FILE_BYTES)})</span></label>
                      <input
                        type="file"
                        required
                        onChange={(e) => handleFilePicked(e.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#FFF1EC] file:text-[#FF6537] file:font-bold file:cursor-pointer cursor-pointer"
                      />
                      {fileError && <p className="text-red-500 mt-1">{fileError}</p>}
                      {pickedFile && !fileError && <p className="text-slate-400 mt-1">{formatFileSize(pickedFile.size)}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อไฟล์ * <span className="font-normal text-slate-400">(เติมให้อัตโนมัติ แก้ไขได้)</span></label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น สัญญาว่าจ้างพนักงาน"
                        value={newName}
                        onChange={(e) => { setNewName(e.target.value); setNameTouched(true); }}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">บันทึกเพิ่มเติม <span className="font-normal text-slate-400">(ไม่บังคับ)</span></label>
                      <input
                        type="text"
                        placeholder="เขียนบันทึกว่าไฟล์นี้ใช้ทำอะไร"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    {!currentFolderId ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">ประเภทสิทธิ์</label>
                          <Dropdown<LinkedDoc['scope']>
                            value={newScope}
                            onChange={setNewScope}
                            size="compact"
                            options={[
                              { value: 'ส่วนตัว', label: 'ส่วนตัว' },
                              { value: 'ทีม', label: 'ทีม' }
                            ]}
                          />
                        </div>
                        {newScope === 'ทีม' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">เลือกทีม</label>
                            <Dropdown<Department | '__unset__'>
                              value={newTeam || '__unset__'}
                              onChange={(value) => setNewTeam(value === '__unset__' ? '' : value)}
                              placeholder="ไม่ระบุทีม"
                              size="compact"
                              options={[
                                { value: '__unset__', label: 'ไม่ระบุทีม' },
                                ...TEAM_OPTIONS.map((team) => ({ value: team, label: team }))
                              ]}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2">
                        <span>สิทธิ์:</span>
                        <span className={`font-semibold px-1.5 py-0.5 rounded-full text-[10px] ${currentFolder?.scope === 'ทีม' ? getDeptTagClass(currentFolder?.team) : 'text-slate-600 bg-slate-200'}`}>
                          {currentFolder?.scope === 'ทีม' ? (currentFolder?.team || 'ทีม') : 'ส่วนตัว'}
                        </span>
                        <span className="text-slate-400">(สืบทอดจากโฟลเดอร์นี้)</span>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={closeAddForm} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                      <button
                        type="submit"
                        disabled={!newName.trim() || !pickedFile || isSubmittingFile}
                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${newName.trim() && pickedFile && !isSubmittingFile ? 'bg-[#FF6537] text-white hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] text-white cursor-not-allowed'}`}
                      >
                        {isSubmittingFile ? 'กำลังอัปโหลด...' : 'อัปโหลดไฟล์'}
                      </button>
                    </div>
                  </form>
                )}

                {addMode === 'link' && (
                  <form onSubmit={handleAttachLink} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">ลิงก์ URL *</label>
                      <input
                        type="url"
                        required
                        autoFocus
                        placeholder="https://docs.google.com/... หรือวางลิงก์ไฟล์ใดๆ"
                        value={newUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อเรียกเอกสาร * <span className="font-normal text-slate-400">(เติมให้อัตโนมัติ แก้ไขได้)</span></label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ข้อมูลแผนงบการตลาด Q3"
                        value={newName}
                        onChange={(e) => { setNewName(e.target.value); setNameTouched(true); }}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                    {!currentFolderId ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">ประเภทสิทธิ์</label>
                          <Dropdown<LinkedDoc['scope']>
                            value={newScope}
                            onChange={setNewScope}
                            size="compact"
                            options={[
                              { value: 'ส่วนตัว', label: 'ส่วนตัว' },
                              { value: 'ทีม', label: 'ทีม' }
                            ]}
                          />
                        </div>
                        {newScope === 'ทีม' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">เลือกทีม</label>
                            <Dropdown<Department | '__unset__'>
                              value={newTeam || '__unset__'}
                              onChange={(value) => setNewTeam(value === '__unset__' ? '' : value)}
                              placeholder="ไม่ระบุทีม"
                              size="compact"
                              options={[
                                { value: '__unset__', label: 'ไม่ระบุทีม' },
                                ...TEAM_OPTIONS.map((team) => ({ value: team, label: team }))
                              ]}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2">
                        <span>สิทธิ์:</span>
                        <span className={`font-semibold px-1.5 py-0.5 rounded-full text-[10px] ${currentFolder?.scope === 'ทีม' ? getDeptTagClass(currentFolder?.team) : 'text-slate-600 bg-slate-200'}`}>
                          {currentFolder?.scope === 'ทีม' ? (currentFolder?.team || 'ทีม') : 'ส่วนตัว'}
                        </span>
                        <span className="text-slate-400">(สืบทอดจากโฟลเดอร์นี้)</span>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={closeAddForm} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                      <button
                        type="submit"
                        disabled={!newName.trim() || !newUrl.trim()}
                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${newName.trim() && newUrl.trim() ? 'bg-[#FF6537] text-white hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] text-white cursor-not-allowed'}`}
                      >
                        แนบลิงก์
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Edit modal — rename a folder/file, or rename + change the URL of a link */}
      {createPortal(
        <AnimatePresence>
          {editDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={closeEdit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">
                    แก้ไข{editDoc.kind === 'folder' ? 'โฟลเดอร์' : editDoc.kind === 'file' ? 'ไฟล์' : 'ลิงก์'}
                  </h3>
                  <button type="button" onClick={closeEdit} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อ *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                    />
                  </div>

                  {editDoc.kind === 'link' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">ลิงก์ URL</label>
                      <input
                        type="url"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF6537]"
                      />
                    </div>
                  )}

                  {editDoc.kind === 'file' && (
                    <button
                      type="button"
                      onClick={() => openFile(editDoc)}
                      className="text-[12px] text-slate-500 hover:underline hover:text-[#FF6537] flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink size={12} className="shrink-0" />
                      <span>เปิด/ดาวน์โหลดไฟล์ {editDoc.fileSize ? `(${formatFileSize(editDoc.fileSize)})` : ''}</span>
                    </button>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ประเภทสิทธิ์</label>
                    <Dropdown<LinkedDoc['scope']>
                      value={editScope}
                      onChange={setEditScope}
                      size="compact"
                      options={[
                        { value: 'ส่วนตัว', label: 'ส่วนตัว' },
                        { value: 'ทีม', label: 'ทีม' }
                      ]}
                    />
                  </div>

                  {editScope === 'ทีม' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">เลือกทีม</label>
                      <Dropdown<Department | '__unset__'>
                        value={editTeam || '__unset__'}
                        onChange={(value) => setEditTeam(value === '__unset__' ? '' : value)}
                        placeholder="ไม่ระบุทีม"
                        size="compact"
                        options={[
                          { value: '__unset__', label: 'ไม่ระบุทีม' },
                          ...TEAM_OPTIONS.map((team) => ({ value: team, label: team }))
                        ]}
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={closeEdit} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                    <button
                      type="submit"
                      disabled={!editName.trim()}
                      className={`px-5 py-2 rounded-lg text-xs font-bold transition-colors ${editName.trim() ? 'bg-[#FF6537] text-white hover:bg-[#e6572c] cursor-pointer' : 'bg-[#F68C6C] text-white cursor-not-allowed'}`}
                    >
                      บันทึก
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Preview modal for any card — real in-browser rendering for PDFs (printable) and images,
          an "open/download" fallback for everything else that can't render inline in a browser */}
      {createPortal(
        <AnimatePresence>
          {previewDoc && (() => {
            const { Icon: PreviewIcon, color: previewColor, isPdf: previewIsPdf, isImage: previewIsImage } = getItemVisual(previewDoc);
            return (
            <div className={`fixed inset-0 z-50 flex items-center justify-center ${previewIsPdf ? '' : 'p-4'}`}>
              <motion.div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setPreviewDocId(null)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`relative bg-white shadow-2xl flex flex-col overflow-hidden ${
                  previewIsPdf ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-4xl max-h-[88vh] rounded-2xl'
                }`}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
                  <h3 className="text-sm font-bold text-slate-800 truncate min-w-0">{previewDoc.name}</h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {previewIsImage && previewDoc.fileDataUrl && (
                      <>
                        <button
                          onClick={zoomOut}
                          disabled={zoomLevel === ZOOM_STEPS[0]}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="ย่อ"
                        >
                          <ZoomOut size={18} />
                        </button>
                        <button
                          onClick={zoomIn}
                          disabled={zoomLevel === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="ขยาย"
                        >
                          <ZoomIn size={18} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setPreviewDocId(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                      title="ปิด"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {previewIsPdf && previewDoc.fileDataUrl ? (
                  <iframe
                    ref={previewIframeRef}
                    src={previewDoc.fileDataUrl}
                    title={previewDoc.name}
                    className="flex-1 w-full"
                  />
                ) : previewIsImage && previewDoc.fileDataUrl ? (
                  <div
                    className={`flex-1 min-h-0 flex items-center justify-center bg-slate-50 p-4 ${
                      zoomLevel > 1 ? 'overflow-auto' : 'overflow-hidden'
                    }`}
                  >
                    <img
                      src={previewDoc.fileDataUrl}
                      alt=""
                      onClick={() => setZoomLevel((z) => (z > 1 ? 1 : ZOOM_STEPS[1]))}
                      className={`max-w-full max-h-full object-contain transition-transform duration-150 ${
                        zoomLevel > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'
                      }`}
                      style={{ transform: `scale(${zoomLevel})` }}
                    />
                  </div>
                ) : previewDoc.kind === 'link' ? (
                  <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center gap-4 p-8 text-center">
                    <Link2 size={56} className="text-emerald-600" />
                    <p className="text-sm text-slate-500 break-all max-w-md">{previewDoc.url}</p>
                    <a
                      href={previewDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF6537] text-white rounded-lg text-sm font-bold hover:bg-[#e6572c] cursor-pointer"
                    >
                      <ExternalLink size={16} /> เปิดลิงก์
                    </a>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center gap-4 p-8 text-center">
                    <PreviewIcon size={56} className={previewColor} />
                    <p className="text-sm text-slate-500">ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ในเบราว์เซอร์ได้</p>
                    <button
                      onClick={() => openFile(previewDoc)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF6537] text-white rounded-lg text-sm font-bold hover:bg-[#e6572c] cursor-pointer"
                    >
                      <ExternalLink size={16} /> เปิด/ดาวน์โหลด {previewDoc.fileSize ? `(${formatFileSize(previewDoc.fileSize)})` : ''}
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
            );
          })()}
        </AnimatePresence>,
        document.body
      )}

      {/* Delete confirmation modal */}
      {createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={() => setDeleteTarget(null)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
              >
                <h3 className="text-base font-bold text-slate-900">ลบรายการนี้?</h3>
                <p className="text-sm text-slate-500">
                  ต้องการลบ "{deleteTarget.name}" ออกจากระบบใช่หรือไม่
                  {deleteTarget.hasChildren && ' รวมถึงไฟล์/ลิงก์/โฟลเดอร์ย่อยทั้งหมดที่อยู่ข้างในด้วย'} การลบไม่สามารถย้อนกลับได้
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold cursor-pointer hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-red-700"
                  >
                    ลบ
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Action toast (add document / new version) */}
      {(addSuccessNotice || editSuccessNotice) && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3.5 flex items-center gap-4">
            <span className="text-sm">{addSuccessNotice ? 'บันทึกรายการสำเร็จแล้ว' : 'บันทึกการแก้ไขสำเร็จแล้ว'}</span>
            <button
              onClick={() => { setAddSuccessNotice(false); setEditSuccessNotice(false); }}
              className="text-[#FF9776] font-semibold text-sm hover:underline cursor-pointer shrink-0"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
