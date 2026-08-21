import { Fragment, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ChevronRight, Folder, Home } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import Header from './Header';
import Sidebar, { NAV_ITEMS } from './Sidebar';
import TaskModal from '../TaskModal';

// Title/subtitle shown in the Header for each route — kept separate from NAV_ITEMS' short
// sidebar labels since some pages (e.g. docs) use different, longer wording for their page title.
const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  dashboard: { title: 'แดชบอร์ด' },
  tasks: { title: 'จัดการงานและโครงงาน' },
  calendar: { title: 'ปฏิทินและตารางเวลา' },
  gantt: { title: 'ตารางภาระงาน' },
  docs: { title: 'เอกสาร Drive', subtitle: 'จัดการและจัดเก็บเอกสารสำหรับใช้งานในองค์กรอย่างปลอดภัย' },
  reports: { title: 'การออกรายงาน' },
  vault: { title: 'คลังรหัสผ่าน', subtitle: 'จัดการและจัดเก็บรหัสผ่านสำหรับใช้งานในองค์กร' },
};

export default function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [breadcrumbMenuOpen, setBreadcrumbMenuOpen] = useState(false);
  const breadcrumbMenuRef = useRef<HTMLSpanElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const activeItem = NAV_ITEMS.find((item) => pathname === `/${item.id}`);
    document.title = activeItem ? `${activeItem.label} - WongWorkpath` : 'WongWorkpath';
  }, [pathname]);

  const activeId = NAV_ITEMS.find((item) => pathname === `/${item.id}`)?.id;
  const pageMeta = activeId ? PAGE_META[activeId] : undefined;

  const {
    isTaskModalOpen,
    closeTaskModal,
    handleSaveTask,
    selectedTaskToEdit,
    employees,
    tasks,
    documents,
    saveDocuments,
    docCurrentFolderId,
    setDocCurrentFolderId
  } = useAppData();

  // On the Docs Drive page, once you've navigated into a folder, the Header's subtitle line
  // becomes a breadcrumb ("เอกสาร Drive > Grow Store") instead of the page's normal static
  // subtitle — the title itself ("เอกสาร Drive") always stays put. Built here (not in DocVault)
  // since it renders inside the shared Header, above <Outlet/>.
  const docBreadcrumbTrail: typeof documents = [];
  if (activeId === 'docs' && docCurrentFolderId) {
    let walkId: string | null = docCurrentFolderId;
    while (walkId) {
      const folder = documents.find((d) => d.id === walkId);
      if (!folder) break;
      docBreadcrumbTrail.unshift(folder);
      walkId = folder.parentId;
    }
  }

  // Once nested 3+ folders deep, the full trail is collapsed to "••• > secondToLast > last".
  // Clicking "•••" opens a small dropdown with exactly 2 fixed stops: the root, and the single
  // hidden folder immediately before the two segments shown — not every intermediate folder.
  const isCollapsible = docBreadcrumbTrail.length > 2;
  const shownTrail = isCollapsible ? docBreadcrumbTrail.slice(-2) : docBreadcrumbTrail;
  const lastHiddenFolder = isCollapsible ? docBreadcrumbTrail[docBreadcrumbTrail.length - 3] : undefined;

  useEffect(() => {
    setBreadcrumbMenuOpen(false);
  }, [docCurrentFolderId]);

  useEffect(() => {
    if (!breadcrumbMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (breadcrumbMenuRef.current && !breadcrumbMenuRef.current.contains(e.target as Node)) {
        setBreadcrumbMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [breadcrumbMenuOpen]);

  const headerSubtitle = docBreadcrumbTrail.length > 0 ? (
    <span className="flex items-center gap-2 min-w-0">
      {isCollapsible ? (
        <span className="relative shrink-0" ref={breadcrumbMenuRef}>
          <button
            onClick={() => setBreadcrumbMenuOpen((prev) => !prev)}
            className="text-[#515151] hover:text-[#FF6537] cursor-pointer font-bold tracking-wider"
            title="แสดงเส้นทางที่ซ่อนอยู่"
          >
            •••
          </button>
          {breadcrumbMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 text-sm z-50">
              <button
                onClick={() => { setDocCurrentFolderId(null); setBreadcrumbMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[#272220] hover:bg-orange-50 cursor-pointer"
              >
                <Home size={15} className="text-[#515151] shrink-0" />
                <span className="truncate">เอกสาร Drive</span>
              </button>
              {lastHiddenFolder && (
                <button
                  onClick={() => { setDocCurrentFolderId(lastHiddenFolder.id); setBreadcrumbMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[#272220] hover:bg-orange-50 cursor-pointer"
                >
                  <Folder size={15} className="text-[#515151] shrink-0" />
                  <span className="truncate">{lastHiddenFolder.name}</span>
                </button>
              )}
            </div>
          )}
        </span>
      ) : (
        <button
          onClick={() => setDocCurrentFolderId(null)}
          className="text-[#515151] hover:text-[#FF6537] cursor-pointer shrink-0"
        >
          เอกสาร Drive
        </button>
      )}
      {shownTrail.map((folder, idx) => (
        <Fragment key={folder.id}>
          <ChevronRight size={16} className="text-slate-300 shrink-0" />
          {idx === shownTrail.length - 1 ? (
            <span className="font-bold text-[#000000] truncate">{folder.name}</span>
          ) : (
            <button
              onClick={() => setDocCurrentFolderId(folder.id)}
              className="text-[#515151] hover:text-[#FF6537] cursor-pointer truncate shrink-0"
            >
              {folder.name}
            </button>
          )}
        </Fragment>
      ))}
    </span>
  ) : pageMeta?.subtitle;

  return (
    <div className="h-dvh overflow-hidden bg-[#FFFFFF] flex gap-1 font-sans text-slate-800 antialiased" id="main-app-container">
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
      />

      {/* Header + Scrollable Main Area column */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          title={pageMeta?.title ?? ''}
          subtitle={headerSubtitle}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:px-8 lg:pt-8 lg:pb-4" >
          <Outlet />
        </main>
      </div>

      {/* Task Creation / Editing Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={closeTaskModal}
        onSave={handleSaveTask}
        task={selectedTaskToEdit}
        employees={employees}
        allTasks={tasks}
        documents={documents}
        onAddDocument={(doc) => saveDocuments([...documents, doc])}
      />
    </div>
  );
}
