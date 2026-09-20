import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronLeft, ChevronRight, Download, LayoutGrid, List, Plus, X } from 'lucide-react';
import searchIcon from '../../../images/icon/Search pass.png';
import { useAppData } from '../../context/AppDataContext';
import { Employee } from '../../types';
import { canDeleteProject, canSeeAllProjects } from '../../lib/permissions';
import { ApiError } from '../../lib/api';
import { isOwner, isResponsibleForProject } from '../../lib/ownership';
import { buildCsv, downloadCsv } from '../../lib/csv';
import { useEscapeToClose } from '../../lib/useEscapeToClose';
import { ProjectRow, ProjectStatus } from './types';
import { STATUS_LABEL, PROJECT_PRIORITY_META, PROJECT_TYPE_META, PROJECT_STATUS_OPTIONS } from './statusMeta';
import { displayName } from './CreateProjectModal';
import StatusSummaryCards from './StatusSummaryCards';
import StatusWidgetSettingsMenu from './StatusWidgetSettingsMenu';
import { loadSelectedStatusIds, saveSelectedStatusIds } from './statusWidgetPrefs';
import ProjectFilterTabs, { ProjectFilter } from './ProjectFilterTabs';
import ProjectTable from './ProjectTable';
import ProjectCard from './ProjectCard';
import ProjectDetail from './ProjectDetail';
import CreateProjectModal from './CreateProjectModal';
import Tooltip from '../Tooltip';

type SortBy = 'newest' | 'oldest' | 'near_deadline' | 'progress' | 'name';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'newest', label: 'ใหม่ไปเก่า' },
  { value: 'oldest', label: 'เก่าไปใหม่' },
  { value: 'near_deadline', label: 'ใกล้ครบกำหนด' },
  { value: 'progress', label: 'ความคืบหน้า' },
  { value: 'name', label: 'ชื่อ (ก-ฮ)' },
];

// Matches the "ทั้งหมด N รายการ • เรียงตาม: ..." result-count/sort control used in
// CredentialVault and DocVault, so all three list pages share the same look and motion.
function SortMenu({ value, onChange }: { value: SortBy; onChange: (v: SortBy) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = SORT_OPTIONS.find((o) => o.value === value)?.label;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1"
      >
        <span className="text-sm text-[#6F6F6F] leading-none mt-1">•</span>
        <span className="text-sm text-[#6F6F6F] leading-none mt-0.5">เรียงตาม: {selectedLabel}</span>
        <ChevronDown
          size={14}
          className={`text-[#272220] transition-transform duration-150 ease-out ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
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
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-sm cursor-pointer ${
                  option.value === value ? 'bg-[#FF6537] text-white font-semibold' : 'text-slate-800 hover:bg-[#FEFAF9]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Shared by both places pagination shows up (the result-count row and, again, next to the status
// filter tabs right above the table — added there since scrolling down to actually read the table
// left the top one out of reach) so the two copies can never drift out of sync with each other.
function PaginationControls({
  currentPage,
  totalPages,
  onPrev,
  onNext,
  onPage,
}: {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex justify-center items-center gap-1.5 shrink-0">
      <button
        onClick={onPrev}
        disabled={currentPage === 1}
        className="w-9 h-9 lg:w-8 lg:h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#FF6537] hover:bg-orange-50 disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1"
      >
        <ChevronLeft size={16} />
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
        <button
          key={pageNum}
          onClick={() => onPage(pageNum)}
          className={`w-9 h-9 lg:w-8 lg:h-8 rounded-lg text-sm font-bold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1 ${
            pageNum === currentPage
              ? 'bg-[#FF6537] text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {pageNum}
        </button>
      ))}
      <button
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="w-9 h-9 lg:w-8 lg:h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#FF6537] hover:bg-orange-50 disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

interface ProjectBoardProps {
  employees: Employee[];
  onCreateFolder: (name: string, parentId: string | null, taskId: string | undefined, projectId: string) => Promise<string>;
  currentUserId: string;
}

const PAGE_SIZE = 3;

export default function ProjectBoard({ employees, onCreateFolder, currentUserId }: ProjectBoardProps) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filter, setFilter] = useState<ProjectFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  // Which up-to-5 statuses the summary cards show — owned here rather than inside
  // StatusSummaryCards because its settings button lives up in this page's toolbar.
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>(loadSelectedStatusIds);
  useEffect(() => {
    saveSelectedStatusIds(selectedStatusIds);
  }, [selectedStatusIds]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  useEscapeToClose(Boolean(deleteTarget), () => setDeleteTarget(null));
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  // Lives in AppDataContext (not local state) so the Header can render the current project's
  // title as a breadcrumb subtitle — same pattern as the Docs page's docCurrentFolderId.
  const {
    projects,
    projectTasks,
    taskSelectedProjectId,
    setTaskSelectedProjectId,
    taskSelectedTab,
    setTaskSelectedTab,
    meetings,
    handleAddMeeting,
    handleUpdateMeeting,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    customProjectStatuses,
    handleAddCustomProjectStatus,
    handleDeleteCustomProjectStatus,
    handleAddProjectTask,
    handleUpdateProjectTask,
    handleDeleteProjectTask,
    changeRequests,
    handleRequestChange,
    handleDecideChangeRequest,
    documents,
    handleAddDocument,
    currentUser,
    orgSections,
  } = useAppData();
  const selectedProject = projects.find((p) => p.id === taskSelectedProjectId) ?? null;
  const setSelectedProject = (row: ProjectRow | null) => setTaskSelectedProjectId(row?.id ?? null);

  const canDelete = currentUser ? canDeleteProject(currentUser) : false;
  // ผู้บริหาร bypasses every ownership-approval gate on this page (delete, inline priority edit,
  // and — via the isExecutive prop threaded into ProjectDetail/AddTaskModal/EditProjectModal —
  // every edit made from inside a project's own detail page too).
  const isExecutive = currentUser ? canSeeAllProjects(currentUser) : false;
  // ผู้บริหาร sees everything by default; every other role defaults to just their own responsible
  // projects with the option to switch to "ทั้งหมด" — see isResponsibleForProject for the exact
  // owner-or-member definition (matches MyWorkspace.tsx's "งานของฉัน" page).
  const [scope, setScope] = useState<'mine' | 'all'>(() => (isExecutive ? 'all' : 'mine'));

  // canDelete (role-based) decides who even sees the delete icon at all; ownership decides whether
  // that click deletes right away or has to go through the same request/approve flow as everyone
  // else editing an owned project — the two checks are independent (see the plan's design decision 3).
  const deleteTargetProject = deleteTarget ? projects.find((p) => p.id === deleteTarget.id) : undefined;
  const deleteCanDirectly = !deleteTargetProject || isExecutive || isOwner(deleteTargetProject.ownerEmployeeIds, currentUserId);
  const deletePendingRequest = deleteTarget
    ? changeRequests.find((r) => r.entityType === 'project' && r.entityId === deleteTarget.id && r.status === 'pending')
    : undefined;

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteReason('');
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      if (deleteCanDirectly) {
        await handleDeleteProject(deleteTarget.id);
      } else {
        await handleRequestChange('project', deleteTarget.id, 'delete', undefined, deleteReason.trim());
      }
      closeDeleteModal();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : deleteCanDirectly ? 'ลบโครงการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsDeleting(false);
    }
  };

  const showActionToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => setActionToast((current) => (current === message ? null : current)), 3000);
  };

  // Everything below the toolbar (status cards, counts, the table itself) reflects the current
  // "ของฉัน"/"ทั้งหมด" scope — otherwise the summary cards would count projects that then don't
  // appear anywhere in the filtered/paginated list underneath them.
  const scopedProjects = useMemo(
    () => (scope === 'mine' && currentUserId ? projects.filter((p) => isResponsibleForProject(p, currentUserId)) : projects),
    [projects, scope, currentUserId]
  );

  // Record<string, number> (not Record<ProjectStatus, number>) since a project's status can now
  // also be a custom status id — every built-in and every known custom status is seeded at 0 so
  // its card can render even with no projects on it yet, plus whatever other status strings
  // actually appear on a project (covers an orphaned/unknown one gracefully too).
  const counts = useMemo(() => {
    const base: Record<string, number> = {};
    PROJECT_STATUS_OPTIONS.forEach((s) => { base[s] = 0; });
    customProjectStatuses.forEach((s) => { base[s.id] = 0; });
    scopedProjects.forEach((p) => {
      base[p.status] = (base[p.status] ?? 0) + 1;
    });
    return base;
  }, [scopedProjects, customProjectStatuses]);

  const hasNearDeadline = useMemo(
    () => scopedProjects.some((p) => p.daysUntilDue !== undefined && p.daysUntilDue <= 2),
    [scopedProjects]
  );

  const filteredRows = useMemo(() => {
    const rows = scopedProjects.filter((p) => {
      if (search.trim() && !p.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (filter === 'all') return true;
      if (filter === 'near_deadline') return p.daysUntilDue !== undefined && p.daysUntilDue <= 2;
      return p.status === filter;
    });

    // A project's own id is `PROJ_<created-at-epoch-ms>` (server-generated, or client-pre-generated
    // for the "create matching Drive folder" flow — same format either way) — no separate sortable
    // timestamp is exposed to the client, so this doubles as one instead of adding a field just for
    // this. `createdDate` alone can't do it: it's a pre-formatted Thai display string ("18 ก.ย.
    // 2569"), not something that sorts correctly as text.
    const createdAtMs = (p: ProjectRow) => Number(p.id.replace(/^PROJ_/, '')) || 0;

    const sorted = [...rows];
    if (sortBy === 'newest') {
      sorted.sort((a, b) => createdAtMs(b) - createdAtMs(a));
    } else if (sortBy === 'oldest') {
      sorted.sort((a, b) => createdAtMs(a) - createdAtMs(b));
    } else if (sortBy === 'near_deadline') {
      sorted.sort((a, b) => (a.daysUntilDue ?? Infinity) - (b.daysUntilDue ?? Infinity));
    } else if (sortBy === 'progress') {
      sorted.sort((a, b) => (b.progress ?? -1) - (a.progress ?? -1));
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'th'));
    }
    return sorted;
  }, [scopedProjects, search, filter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Snap back to the last page that still has items once a filter/search/sort change (or a
  // deletion) empties out the current page — same pattern as CredentialVault's own pager.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // taskSelectedTab is a one-shot deep-link (e.g. clicking a meeting on the Calendar page opens
  // straight to ProjectDetail's "การประชุม" tab) — ProjectDetail's own `useState(initialTab ?? ...)`
  // already latched it as its starting tab by the time this runs, so it's safe to clear here
  // right after, or a later re-entry into a project (without an explicit tab request) would
  // wrongly reopen on whatever tab was last deep-linked to.
  useEffect(() => {
    if (selectedProject && taskSelectedTab) setTaskSelectedTab(null);
  }, [selectedProject, taskSelectedTab, setTaskSelectedTab]);

  // Exports the currently-filtered result set (not just the current page) — a report should
  // reflect what the user searched/filtered for, not an incidental screen-sized slice of it.
  const handleExportCsv = () => {
    const headers = ['รหัส', 'เรื่อง', 'รายละเอียด', 'ประเภทโครงการ', 'ตัวย่อชื่อโครงการ', 'งบประมาณ', 'ระดับความสำคัญ', 'ผู้รับผิดชอบหลัก', 'ความคืบหน้า (%)', 'วันที่เริ่ม', 'วันที่สิ้นสุด', 'สร้างเมื่อ', 'สถานะ'];
    const rows = filteredRows.map((row) => {
      const owners = row.ownerEmployeeIds.map((id) => employees.find((e) => e.id === id)).filter((e): e is Employee => Boolean(e));
      return [
        row.code,
        row.title,
        row.description ?? '',
        row.type ? `${PROJECT_TYPE_META[row.type].label} (${row.type})` : '',
        row.abbreviation ?? '',
        row.budget ?? '',
        row.priority ? PROJECT_PRIORITY_META[row.priority].label : '',
        owners.map((o) => displayName(o)).join(', '),
        row.progress ?? '',
        row.startDate ?? '',
        row.endDate ?? '',
        row.createdDate ?? '',
        STATUS_LABEL[row.status],
      ];
    });
    downloadCsv(`โครงการ-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(headers, rows));
  };

  if (selectedProject) {
    return (
      <ProjectDetail
        row={selectedProject}
        tasks={projectTasks.filter((t) => t.projectId === selectedProject.id)}
        meetings={meetings}
        employees={employees}
        currentUserId={currentUserId}
        initialTab={taskSelectedTab}
        onAddTask={handleAddProjectTask}
        onUpdateTask={handleUpdateProjectTask}
        onDeleteTask={handleDeleteProjectTask}
        onAddMeeting={handleAddMeeting}
        onUpdateMeeting={handleUpdateMeeting}
        onCreateFolder={onCreateFolder}
        onUpdateProject={(updates) => handleUpdateProject(selectedProject.id, updates)}
        existingProjectTitles={projects.map((p) => p.title)}
        customStatuses={customProjectStatuses}
        changeRequests={changeRequests}
        onRequestChange={handleRequestChange}
        onDecideChangeRequest={handleDecideChangeRequest}
        documents={documents}
        onAddDocument={handleAddDocument}
        orgSections={orgSections}
        isExecutive={isExecutive}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky under Header (same pattern as EmployeeManagement/Dashboard) so the search/toolbar
          row stays put while the status cards and table scroll under it. */}
      <div className="sticky -top-4 sm:-top-6 lg:-top-3.75 z-30 bg-[#F6F6F6] pt-1">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        {/* Search grows up to its old fixed 550px but yields width first — the button group
            (min-w-max) never shrinks below its content, so all 4 actions stay on one line. */}
        <div className="relative w-full lg:flex-1 lg:max-w-137.5 lg:min-w-0">
          <img src={searchIcon} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 mt-px w-3.5 h-5 object-contain" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="ค้นหาโครงการ..."
            className="w-full h-10 pl-9 pr-9 bg-white border border-slate-200 rounded-xl text-[13px] font-normal focus:outline-none focus:border-[#FF6537]"
          />
          {search && (
            <Tooltip content="ล้างคำค้นหา">
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="ล้างคำค้นหา"
              >
                <X size={15} />
              </button>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap lg:flex-1 lg:min-w-max">
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => { setScope('mine'); setCurrentPage(1); }}
              className={`px-3 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                scope === 'mine' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
              }`}
            >
              ของฉัน
            </button>
            <button
              type="button"
              onClick={() => { setScope('all'); setCurrentPage(1); }}
              className={`px-3 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                scope === 'all' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
              }`}
            >
              ทั้งหมด
            </button>
          </div>

          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 shrink-0">
            <Tooltip content="มุมมองตาราง">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1 ${
                  view === 'list' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
                }`}
                aria-label="มุมมองตาราง"
              >
                <List size={15} />
              </button>
            </Tooltip>
            <Tooltip content="มุมมองการ์ด">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6537] focus-visible:ring-offset-1 ${
                  view === 'grid' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
                }`}
                aria-label="มุมมองการ์ด"
              >
                <LayoutGrid size={15} />
              </button>
            </Tooltip>
          </div>

          <StatusWidgetSettingsMenu
            selectedIds={selectedStatusIds}
            onChangeSelected={setSelectedStatusIds}
            customStatuses={customProjectStatuses}
            onAddCustomStatus={handleAddCustomProjectStatus}
            onDeleteCustomStatus={handleDeleteCustomProjectStatus}
          />

          <Tooltip content="ส่งออกเป็น CSV">
            <button
              type="button"
              onClick={handleExportCsv}
              className="bg-white hover:bg-slate-50 text-[#272220] text-sm font-bold px-4 h-10 rounded-xl border border-[#E5E5E5] flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap lg:ml-auto transition-colors"
            >
              <Download size={16} />
              Export CSV
            </button>
          </Tooltip>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#FF6537] hover:opacity-90 text-white text-sm font-bold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
          >
            <Plus size={16} />
            สร้างโครงการใหม่
          </button>
        </div>
      </div>
      </div>

      <div className="flex items-center gap-2">
        <p className="font-normal text-[16px] text-[#6F6F6F] leading-none">ทั้งหมด {filteredRows.length} โครงการ</p>
        <SortMenu value={sortBy} onChange={(v) => { setSortBy(v); setCurrentPage(1); }} />
      </div>

      <StatusSummaryCards counts={counts} selectedIds={selectedStatusIds} />

      <div className="flex items-center justify-between gap-2">
        {/* min-w-0 lets this shrink below its content's natural width — without it, a flex row's
            default min-width:auto would push the pagination controls off to the side (or force
            the whole row to overflow) once there are enough tabs/custom statuses to fill the row,
            instead of letting the tabs' own overflow-x-auto handle it. */}
        <div className="min-w-0">
          <ProjectFilterTabs
            active={filter}
            onChange={(v) => { setFilter(v); setCurrentPage(1); }}
            hasNearDeadline={hasNearDeadline}
            customStatuses={customProjectStatuses}
          />
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          onPage={setCurrentPage}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {filteredRows.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm">
              {projects.length === 0 ? 'ยังไม่มีโครงการในระบบ' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
            </div>
          ) : view === 'list' ? (
            <ProjectTable
              rows={paginatedRows}
              employees={employees}
              onViewDetail={setSelectedProject}
              canDelete={canDelete}
              onDelete={(row) => setDeleteTarget({ id: row.id, title: row.title })}
              onUpdatePriority={(row, priority) => handleUpdateProject(row.id, { priority })}
              currentUserId={currentUserId}
              isExecutive={isExecutive}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedRows.map((row) => (
                <ProjectCard key={row.id} row={row} employees={employees} onViewDetail={() => setSelectedProject(row)} />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        getNextCodePreview={(abbreviation, type) => {
          if (!abbreviation || !type) return 'จะสร้างอัตโนมัติ';
          const yy = String((new Date().getFullYear() + 543) % 100).padStart(2, '0');
          const yearCodePattern = new RegExp(`-${yy}-[A-Za-z]+-(\\d+)$`);
          const seqNumbers = projects
            .map((p) => Number(p.code.match(yearCodePattern)?.[1]))
            .filter((n) => !Number.isNaN(n));
          const next = (seqNumbers.length ? Math.max(...seqNumbers) : 0) + 1;
          return `${abbreviation}-${yy}-${type}-${String(next).padStart(3, '0')}`;
        }}
        onCreate={async (payload) => {
          await handleAddProject({ ...payload, createdBy: currentUserId });
        }}
        onCreated={(title, folderCreated) =>
          showActionToast(
            folderCreated
              ? `สร้างโครงการ "${title}" และโฟลเดอร์เอกสารสำเร็จแล้ว`
              : `สร้างโครงการ "${title}" สำเร็จแล้ว`
          )
        }
        employees={employees}
        onCreateFolder={onCreateFolder}
        existingTitles={projects.map((p) => p.title)}
        customStatuses={customProjectStatuses}
      />

      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3.5 flex items-center gap-4">
            <span className="text-sm">{actionToast}</span>
            <button
              onClick={() => setActionToast(null)}
              className="text-[#FF9776] font-semibold text-sm hover:underline cursor-pointer shrink-0"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation — same modal shape as EmployeeManagement's delete confirmation, only
          reachable at all when canDelete is true (ProjectTable never renders the delete icon
          otherwise, so deleteTarget can only be set here by an admin/superadmin/executive). */}
      {createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="absolute inset-0 bg-black/15 backdrop-blur-sm"
                onClick={closeDeleteModal}
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
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">ลบโครงการ</h3>
                  <button type="button" onClick={closeDeleteModal} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                {deletePendingRequest ? (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    มีคำขอลบรออนุมัติอยู่แล้วสำหรับ "{deleteTarget?.title}" — เหตุผล: {deletePendingRequest.reason}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-slate-600">
                      {deleteCanDirectly
                        ? <>ยืนยันการลบโครงการ <span className="font-bold text-slate-800">"{deleteTarget?.title}"</span> ออกจากระบบถาวร — ไม่สามารถกู้คืนได้</>
                        : <>โครงการ <span className="font-bold text-slate-800">"{deleteTarget?.title}"</span> มีผู้รับผิดชอบหลักแล้ว ต้องขออนุมัติก่อนจึงจะลบได้</>}
                    </p>

                    {!deleteCanDirectly && (
                      <textarea
                        rows={2}
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        placeholder="เหตุผลที่ขอลบ..."
                        className="w-full p-2.5 text-xs border border-[#E5E5E5] rounded-lg placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#FF6537]"
                      />
                    )}
                  </>
                )}

                {deleteError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg">
                    {deleteError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={closeDeleteModal} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                  {!deletePendingRequest && (
                    <button
                      onClick={confirmDelete}
                      disabled={isDeleting || (!deleteCanDirectly && !deleteReason.trim())}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold text-white ${isDeleting || (!deleteCanDirectly && !deleteReason.trim()) ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 cursor-pointer'}`}
                    >
                      {deleteCanDirectly
                        ? (isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ')
                        : (isDeleting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอลบ')}
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
