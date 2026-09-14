import { Fragment, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Folder, Home } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import Header from './Header';
import Sidebar, { NAV_ITEMS } from './Sidebar';
import AddTaskModal from '../projectBoard/AddTaskModal';
import { STATUS_LABEL, STATUS_PILL, STATUS_ICON } from '../projectBoard/statusMeta';
import { createDocFolder } from '../../lib/docFolder';

// Title/subtitle shown in the Header for each route — kept separate from NAV_ITEMS' short
// sidebar labels since some pages (e.g. docs) use different, longer wording for their page title.
const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  dashboard: { title: 'แดชบอร์ด', subtitle: 'ภาพรวมโครงการ งบประมาณ และภาระงานทั้งองค์กรในหน้าเดียว' },
  tasks: { title: 'จัดการงานและโครงการ', subtitle: 'วางแผนและติดตามความคืบหน้าของโครงการทั้งหมด' },
  calendar: { title: 'ปฏิทินและตารางเวลา', subtitle: 'ดูภาพรวมงานและการประชุมทั้งหมดในปฏิทินเดียว' },
  gantt: { title: 'งานของฉัน', subtitle: 'งาน โครงการ และ Gantt Chart ของคุณเองในที่เดียว' },
  docs: { title: 'เอกสาร Drive', subtitle: 'จัดการและจัดเก็บเอกสารสำหรับใช้งานในองค์กรอย่างปลอดภัย' },
  vault: { title: 'คลังรหัสผ่าน', subtitle: 'จัดการและจัดเก็บรหัสผ่านสำหรับใช้งานในองค์กร' },
  employees: { title: 'จัดการพนักงาน', subtitle: 'สร้างและจัดการบัญชีพนักงานในองค์กร' },
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
    handleAddProjectTask,
    handleAddMeeting,
    employees,
    projects,
    documents,
    saveDocuments,
    docCurrentFolderId,
    setDocCurrentFolderId,
    taskSelectedProjectId,
    setTaskSelectedProjectId,
    currentUser
  } = useAppData();

  const handleCreateFolder = (name: string, parentId: string | null = null, taskId?: string) =>
    createDocFolder(name, parentId, taskId, documents, saveDocuments, currentUser?.name || 'ผู้ใช้งานปัจจุบัน');

  // On the Tasks page, once a project's detail view is open, the Header swaps to the project's
  // own name as the title (with a back arrow to return to the list) and status+code as the
  // subtitle underneath — instead of the page's normal static title/subtitle. Title/status/code
  // used to repeat again inside ProjectDetail's own page body; now shown once, here.
  const selectedProject = activeId === 'tasks'
    ? projects.find((p) => p.id === taskSelectedProjectId)
    : undefined;
  const SelectedProjectStatusIcon = selectedProject ? STATUS_ICON[selectedProject.status] : null;

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
  ) : selectedProject ? (
    // This whole line sits inside Header's 20px subtitle <p> — without an explicit size, the code
    // span used to inherit that 20px, dwarfing the 11px status pill right next to it. A thin
    // border (tinted to the status's own color) keeps the pill legible here too: its pale fills
    // like draft's near-white were designed to sit on a white card, not directly on the page's
    // #F6F6F6 background, where they'd otherwise all but disappear.
    <span className="flex items-center gap-2 min-w-0">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap shrink-0"
        style={{
          backgroundColor: STATUS_PILL[selectedProject.status].bg,
          color: STATUS_PILL[selectedProject.status].text,
          borderColor: `${STATUS_PILL[selectedProject.status].text}33`,
        }}
      >
        {SelectedProjectStatusIcon && <SelectedProjectStatusIcon size={11} strokeWidth={2} />}
        {STATUS_LABEL[selectedProject.status]}
      </span>
      <span className="text-[13px] text-[#A0A0A0] shrink-0">{selectedProject.code}</span>
    </span>
  ) : pageMeta?.subtitle;

  const headerTitle = selectedProject ? (
    <span className="inline-flex items-center gap-3 min-w-0">
      <button
        type="button"
        onClick={() => setTaskSelectedProjectId(null)}
        title="กลับไปหน้ารายการโครงการ"
        className="text-[#515151] hover:text-[#FF6537] cursor-pointer shrink-0"
      >
        <ArrowLeft size={28} />
      </button>
      <span className="truncate">{selectedProject.title}</span>
    </span>
  ) : (pageMeta?.title ?? '');

  return (
    <div className="h-dvh overflow-hidden bg-[#F6F6F6] flex gap-1 font-sans text-slate-800 antialiased" id="main-app-container">
      {/* contents, not a plain div — Sidebar's <aside> has no height of its own, it relies on
          being a direct flex child of this row (h-dvh + default align-items:stretch) to fill the
          viewport; a plain wrapper div here breaks out of that flex context and collapses it to
          its content's natural height instead. `contents` keeps the child a real flex participant
          while still letting print:hidden hide it (and everything inside it) when printing. */}
      <div className="contents print:hidden">
        <Sidebar
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        />
      </div>

      {/* Header + Scrollable Main Area column */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="contents print:hidden">
          <Header
            title={headerTitle}
            subtitle={headerSubtitle}
            isMobileMenuOpen={isMobileMenuOpen}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:px-8 lg:pt-8 lg:pb-4 bg-[#F6F6F6] print:overflow-visible print:p-0" >
          <Outlet />
        </main>
      </div>

      {/* Dashboard's "เพิ่มงาน" quick-add — same real AddTaskModal every project uses, just opened
          without a fixed project context, so it shows its own required project picker first. */}
      <AddTaskModal
        isOpen={isTaskModalOpen}
        onClose={closeTaskModal}
        onSave={handleAddProjectTask}
        onAddMeeting={handleAddMeeting}
        onCreateFolder={handleCreateFolder}
        projectId=""
        projects={projects}
        employees={employees}
        currentUserId={currentUser?.id ?? ''}
      />
    </div>
  );
}
