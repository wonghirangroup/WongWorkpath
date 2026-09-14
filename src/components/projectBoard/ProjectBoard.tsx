import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, LayoutGrid, List, Plus, X } from 'lucide-react';
import searchIcon from '../../../images/icon/Search pass.png';
import { useAppData } from '../../context/AppDataContext';
import { Employee } from '../../types';
import { canDeleteProject } from '../../lib/permissions';
import { ApiError } from '../../lib/api';
import { ProjectRow, ProjectStatus } from './types';
import StatusSummaryCards from './StatusSummaryCards';
import ProjectFilterTabs, { ProjectFilter } from './ProjectFilterTabs';
import ProjectTable from './ProjectTable';
import ProjectCard from './ProjectCard';
import ProjectDetail from './ProjectDetail';
import CreateProjectModal from './CreateProjectModal';

type SortBy = 'latest' | 'near_deadline' | 'progress' | 'name';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'latest', label: 'ล่าสุด' },
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
        className="flex items-center gap-2 cursor-pointer"
        title="เรียงตาม"
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

interface ProjectBoardProps {
  employees: Employee[];
  onCreateFolder: (name: string, parentId?: string | null, taskId?: string) => string;
  currentUserId: string;
}

export default function ProjectBoard({ employees, onCreateFolder, currentUserId }: ProjectBoardProps) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filter, setFilter] = useState<ProjectFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('latest');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Lives in AppDataContext (not local state) so the Header can render the current project's
  // title as a breadcrumb subtitle — same pattern as the Docs page's docCurrentFolderId.
  const {
    projects,
    projectTasks,
    taskSelectedProjectId,
    setTaskSelectedProjectId,
    meetings,
    handleAddMeeting,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    handleAddProjectTask,
    handleUpdateProjectTask,
    handleDeleteProjectTask,
    currentUser,
  } = useAppData();
  const selectedProject = projects.find((p) => p.id === taskSelectedProjectId) ?? null;
  const setSelectedProject = (row: ProjectRow | null) => setTaskSelectedProjectId(row?.id ?? null);

  const canDelete = currentUser ? canDeleteProject(currentUser) : false;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await handleDeleteProject(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'ลบโครงการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsDeleting(false);
    }
  };

  const showActionToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => setActionToast((current) => (current === message ? null : current)), 3000);
  };

  const counts = useMemo(() => {
    const base: Record<ProjectStatus, number> = { in_progress: 0, completed: 0, on_hold: 0, cancelled: 0, draft: 0 };
    projects.forEach((p) => {
      base[p.status] += 1;
    });
    return base;
  }, [projects]);

  const hasNearDeadline = useMemo(
    () => projects.some((p) => p.daysUntilDue !== undefined && p.daysUntilDue <= 2),
    [projects]
  );

  const filteredRows = useMemo(() => {
    const rows = projects.filter((p) => {
      if (search.trim() && !p.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (filter === 'all') return true;
      if (filter === 'near_deadline') return p.daysUntilDue !== undefined && p.daysUntilDue <= 2;
      return p.status === filter;
    });

    if (sortBy === 'latest') return rows;

    const sorted = [...rows];
    if (sortBy === 'near_deadline') {
      sorted.sort((a, b) => (a.daysUntilDue ?? Infinity) - (b.daysUntilDue ?? Infinity));
    } else if (sortBy === 'progress') {
      sorted.sort((a, b) => (b.progress ?? -1) - (a.progress ?? -1));
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'th'));
    }
    return sorted;
  }, [projects, search, filter, sortBy]);

  if (selectedProject) {
    return (
      <ProjectDetail
        row={selectedProject}
        tasks={projectTasks.filter((t) => t.projectId === selectedProject.id)}
        meetings={meetings}
        employees={employees}
        currentUserId={currentUserId}
        onAddTask={handleAddProjectTask}
        onUpdateTask={handleUpdateProjectTask}
        onDeleteTask={handleDeleteProjectTask}
        onAddMeeting={handleAddMeeting}
        onCreateFolder={onCreateFolder}
        onUpdateProject={(updates) => handleUpdateProject(selectedProject.id, updates)}
        existingProjectTitles={projects.map((p) => p.title)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative w-full lg:w-137.5 lg:flex-none">
          <img src={searchIcon} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 mt-px w-3.5 h-5 object-contain" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาโครงการ..."
            className="w-full h-10 pl-9 pr-9 bg-white border border-slate-200 rounded-xl text-[13px] font-normal focus:outline-none focus:border-[#FF6537]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="ล้างคำค้นหา"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => setView('list')}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                view === 'list' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
              }`}
              title="มุมมองตาราง"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => setView('grid')}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                view === 'grid' ? 'bg-[#FF6537] text-white' : 'text-[#6F6F6F] hover:text-[#272220]'
              }`}
              title="มุมมองการ์ด"
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#FF6537] hover:opacity-90 text-white text-sm font-bold px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap lg:ml-auto transition-colors"
          >
            <Plus size={16} />
            สร้างโครงการใหม่
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <p className="font-normal text-[16px] text-[#6F6F6F] leading-none">ทั้งหมด {filteredRows.length} โครงการ</p>
        <SortMenu value={sortBy} onChange={setSortBy} />
      </div>

      <StatusSummaryCards counts={counts} />

      <ProjectFilterTabs active={filter} onChange={setFilter} hasNearDeadline={hasNearDeadline} />

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
              rows={filteredRows}
              employees={employees}
              onViewDetail={setSelectedProject}
              canDelete={canDelete}
              onDelete={(row) => setDeleteTarget({ id: row.id, title: row.title })}
              onUpdatePriority={(row, priority) => handleUpdateProject(row.id, { priority })}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRows.map((row) => (
                <ProjectCard key={row.id} row={row} employees={employees} onViewDetail={() => setSelectedProject(row)} />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        nextCode={`PRJ-${String(projects.length + 1).padStart(3, '0')}`}
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
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">ลบโครงการ</h3>
                  <button type="button" onClick={() => setDeleteTarget(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
                </div>

                <p className="text-xs text-slate-600">
                  ยืนยันการลบโครงการ <span className="font-bold text-slate-800">"{deleteTarget?.title}"</span> ออกจากระบบถาวร — ไม่สามารถกู้คืนได้
                </p>

                {deleteError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg">
                    {deleteError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">ยกเลิก</button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold text-white ${isDeleting ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 cursor-pointer'}`}
                  >
                    {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
                  </button>
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
