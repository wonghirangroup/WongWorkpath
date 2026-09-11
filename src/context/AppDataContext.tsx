import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  Employee,
  Task,
  LinkedDoc,
  CredentialItem,
  LeaveRequest,
  Meeting,
  Notification,
  AuditLog,
  HandoverRecord
} from '../types';
import { DEFAULT_ORG_DIVISIONS, OrgDivisionData } from '../data/orgStructure';
import {
  INITIAL_EMPLOYEES,
  INITIAL_DOCS,
  INITIAL_TASKS,
  INITIAL_CREDENTIALS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_NOTIFICATIONS
} from '../data/mockData';
import { fetchEmployees, createEmployee, updateEmployeeRemote, deleteEmployeeRemote, fetchCredentials, createCredential, updateCredentialRemote, deleteCredentialRemote, fetchProjects, createProject, updateProjectRemote, deleteProjectRemote, CreateProjectPayload } from '../lib/api';
import { nowTimestamp } from '../lib/datetime';
import type { ProjectRow } from '../components/projectBoard/types';

// One-time shape migration for documents saved to localStorage before the Drive redesign added
// `kind`/`parentId` (folders + file uploads) in place of the old `type` enum — without this,
// anyone with pre-existing `unityspace_docs` data would have every saved doc silently vanish
// (root-level filtering keys off `parentId === null`, which a missing field never satisfies).
function normalizeStoredDoc(raw: any): LinkedDoc {
  if (raw.kind) return { parentId: raw.parentId ?? null, scope: raw.scope ?? 'ส่วนตัว', ...raw };
  return {
    ...raw,
    kind: 'link',
    parentId: raw.parentId ?? null,
    url: raw.url ?? '',
    scope: raw.scope ?? 'ส่วนตัว'
  };
}

interface AppDataContextValue {
  // Auth
  currentUser: Employee | null;
  isRestoringSession: boolean;
  handleLogin: (employee: Employee) => void;
  handleLogout: () => void;

  // Domain data
  employees: Employee[];
  projects: ProjectRow[];
  tasks: Task[];
  documents: LinkedDoc[];
  credentials: CredentialItem[];
  leaveRequests: LeaveRequest[];
  meetings: Meeting[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  unreadCount: number;

  // Task Modal
  isTaskModalOpen: boolean;
  selectedTaskToEdit: Task | null;
  openAddTaskModal: () => void;
  openEditTaskModal: (task: Task) => void;
  closeTaskModal: () => void;

  // Mutations
  handleAddEmployee: (employee: Employee & { password: string }) => Promise<void>;
  handleUpdateEmployee: (
    id: string,
    updates: Partial<Pick<Employee, 'name' | 'nickname' | 'role' | 'avatar' | 'department' | 'division' | 'username' | 'accountType' | 'restrictedMenuIds' | 'phone' | 'address'>> & { password?: string }
  ) => Promise<void>;
  handleDeleteEmployee: (id: string) => Promise<void>;
  handleAddProject: (payload: CreateProjectPayload) => Promise<ProjectRow>;
  handleUpdateProject: (id: string, updates: Partial<ProjectRow>) => Promise<void>;
  handleDeleteProject: (id: string) => Promise<void>;
  handleSaveTask: (taskData: Partial<Task>) => void;
  handleDeleteTask: (id: string) => void;
  handleInitiateHandover: (taskId: string, fromUserId: string, toUserId: string, stageName: string, notes: string) => void;
  handleApproveHandover: (taskId: string, handoverId: string, approved: boolean, notes: string) => void;
  handleAddDocument: (newDoc: LinkedDoc) => void;
  handleEditDocument: (docId: string, updates: { name: string; url?: string; scope: LinkedDoc['scope']; team?: string }) => void;
  handleDeleteDocument: (docId: string) => void;
  handleMoveDocument: (docId: string, newParentId: string) => void;
  saveDocuments: (newDocs: LinkedDoc[]) => void;
  // Which Drive folder is currently open — shared with AppLayout so the Header can render it as
  // a breadcrumb title ("เอกสาร Drive > Grow Store") instead of the page's normal static title.
  docCurrentFolderId: string | null;
  setDocCurrentFolderId: (id: string | null) => void;
  // Which project's detail view is currently open on the Tasks page — shared with AppLayout so
  // the Header can render it as a breadcrumb subtitle ("จัดการงานและโครงการ > Grow store") instead
  // of the page's normal static subtitle, same pattern as docCurrentFolderId above.
  taskSelectedProjectId: string | null;
  setTaskSelectedProjectId: (id: string | null) => void;
  handleAddLeaveRequest: (newLeave: Omit<LeaveRequest, 'id'>) => void;
  handleApproveLeave: (leaveId: string, approved: boolean) => void;
  handleAddMeeting: (newMeeting: Omit<Meeting, 'id'>) => void;
  handleAddCredential: (newItem: CredentialItem) => void;
  handleUpdateCredential: (id: string, updates: Partial<CredentialItem>) => void;
  handleDeleteCredential: (id: string) => void;
  handleLogAudit: (action: string, details: string) => void;
  handleMarkAllNotificationsRead: () => void;

  // Org chart structure (โครงสร้างองค์กร) — admin-editable from Employee Management's
  // โครงสร้างองค์กร tab. `orgSections` is every section flattened, in division order, for the
  // various department/team pickers throughout the app.
  orgDivisions: OrgDivisionData[];
  orgSections: string[];
  handleAddDivision: (name: string) => void;
  handleRenameDivision: (oldName: string, newName: string) => void;
  handleDeleteDivision: (name: string) => void;
  handleAddSection: (divisionName: string, sectionName: string) => void;
  handleRenameSection: (divisionName: string, oldName: string, newName: string) => void;
  handleDeleteSection: (divisionName: string, sectionName: string) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider');
  return ctx;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  // Auth
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Persistence States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<LinkedDoc[]>([]);
  const [docCurrentFolderId, setDocCurrentFolderId] = useState<string | null>(null);
  const [taskSelectedProjectId, setTaskSelectedProjectId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [orgDivisions, setOrgDivisions] = useState<OrgDivisionData[]>(DEFAULT_ORG_DIVISIONS);
  const orgSections = useMemo(() => orgDivisions.flatMap((d) => d.sections), [orgDivisions]);

  // Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTaskToEdit, setSelectedTaskToEdit] = useState<Task | null>(null);

  // Employees now live in the real `employee` table (see server/routes/employees.ts) instead of
  // localStorage-only mock data. Show the cached/mock list immediately so the UI isn't blocked on
  // the network, then refresh from the API once it answers; if the API is unreachable, the
  // cached/mock data silently stays as-is.
  useEffect(() => {
    let cancelled = false;

    const localEmployees = localStorage.getItem('unityspace_employees');
    if (localEmployees) setEmployees(JSON.parse(localEmployees));
    else {
      setEmployees(INITIAL_EMPLOYEES);
      localStorage.setItem('unityspace_employees', JSON.stringify(INITIAL_EMPLOYEES));
    }

    fetchEmployees()
      .then((apiEmployees) => {
        if (cancelled) return;
        setEmployees(apiEmployees);
        localStorage.setItem('unityspace_employees', JSON.stringify(apiEmployees));
      })
      .catch((err) => {
        console.warn('Could not load employees from the API, using cached/mock data instead:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Credential Vault items now live in the real `credential` table too (see
  // server/routes/credentials.ts) — same show-cached-then-refresh pattern as employees above.
  useEffect(() => {
    let cancelled = false;

    fetchCredentials()
      .then((apiCredentials) => {
        if (cancelled) return;
        setCredentials(apiCredentials);
        localStorage.setItem('unityspace_credentials', JSON.stringify(apiCredentials));
      })
      .catch((err) => {
        console.warn('Could not load credentials from the API, using cached/mock data instead:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Projects live in the real `project` table (see server/routes/projects.ts) with no
  // localStorage layer at all — unlike employees/credentials there's no legacy mock data worth
  // caching or falling back to, since the user is creating every real project from scratch.
  useEffect(() => {
    let cancelled = false;

    fetchProjects()
      .then((apiProjects) => {
        if (cancelled) return;
        setProjects(apiProjects);
      })
      .catch((err) => {
        console.warn('Could not load projects from the API:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize remaining domain data on mount (still localStorage/mock-only — no backend yet)
  useEffect(() => {
    const localTasks = localStorage.getItem('unityspace_tasks');
    const localDocs = localStorage.getItem('unityspace_docs');
    const localCredentials = localStorage.getItem('unityspace_credentials');
    const localLeaves = localStorage.getItem('unityspace_leaves');
    const localNotifications = localStorage.getItem('unityspace_notifications');
    const localLogs = localStorage.getItem('unityspace_audit_logs');
    const localOrgDivisions = localStorage.getItem('unityspace_org_divisions');

    if (localTasks) setTasks(JSON.parse(localTasks));
    else {
      setTasks(INITIAL_TASKS);
      localStorage.setItem('unityspace_tasks', JSON.stringify(INITIAL_TASKS));
    }

    if (localDocs) setDocuments((JSON.parse(localDocs) as any[]).map(normalizeStoredDoc));
    else {
      setDocuments(INITIAL_DOCS);
      localStorage.setItem('unityspace_docs', JSON.stringify(INITIAL_DOCS));
    }

    if (localCredentials) setCredentials(JSON.parse(localCredentials));
    else {
      setCredentials(INITIAL_CREDENTIALS);
      localStorage.setItem('unityspace_credentials', JSON.stringify(INITIAL_CREDENTIALS));
    }

    if (localLeaves) setLeaveRequests(JSON.parse(localLeaves));
    else {
      setLeaveRequests(INITIAL_LEAVE_REQUESTS);
      localStorage.setItem('unityspace_leaves', JSON.stringify(INITIAL_LEAVE_REQUESTS));
    }

    // No mock seed — meetings is a brand-new feature with no historical demo data to backfill.
    const localMeetings = localStorage.getItem('unityspace_meetings');
    if (localMeetings) setMeetings(JSON.parse(localMeetings));

    if (localNotifications) setNotifications(JSON.parse(localNotifications));
    else {
      setNotifications(INITIAL_NOTIFICATIONS);
      localStorage.setItem('unityspace_notifications', JSON.stringify(INITIAL_NOTIFICATIONS));
    }

    if (localLogs) setAuditLogs(JSON.parse(localLogs));
    else {
      const initialLogs: AuditLog[] = [
        {
          id: 'LOG01',
          timestamp: '2026-07-02 09:00',
          user: 'ผู้จัดการระบบ',
          role: '-',
          department: '',
          action: 'SYSTEM_STARTUP',
          details: 'เริ่มต้นระบบจัดการแผนงานและข้อมูลความปลอดภัย UnitySpace สมบูรณ์แบบ'
        }
      ];
      setAuditLogs(initialLogs);
      localStorage.setItem('unityspace_audit_logs', JSON.stringify(initialLogs));
    }

    if (localOrgDivisions) setOrgDivisions(JSON.parse(localOrgDivisions));
    else localStorage.setItem('unityspace_org_divisions', JSON.stringify(DEFAULT_ORG_DIVISIONS));
  }, []);

  // Restore login session once the employee directory has loaded
  useEffect(() => {
    if (employees.length === 0) return;

    const savedUserId = localStorage.getItem('unityspace_current_user_id');
    if (savedUserId) {
      const savedUser = employees.find(emp => emp.id === savedUserId);
      if (savedUser) setCurrentUser(savedUser);
    }
    setIsRestoringSession(false);
  }, [employees]);

  const handleLogin = (employee: Employee) => {
    setCurrentUser(employee);
    localStorage.setItem('unityspace_current_user_id', employee.id);
    handleLogAudit('LOGIN', `${employee.name} เข้าสู่ระบบ`, employee);
  };

  const handleLogout = () => {
    if (currentUser) handleLogAudit('LOGOUT', `${currentUser.name} ออกจากระบบ`);
    setCurrentUser(null);
    localStorage.removeItem('unityspace_current_user_id');
  };

  // Sync to localStorage helpers
  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem('unityspace_tasks', JSON.stringify(newTasks));
  };

  const saveDocs = (newDocs: LinkedDoc[]) => {
    setDocuments(newDocs);
    localStorage.setItem('unityspace_docs', JSON.stringify(newDocs));
  };

  const saveCredentials = (newCreds: CredentialItem[]) => {
    setCredentials(newCreds);
    localStorage.setItem('unityspace_credentials', JSON.stringify(newCreds));
  };

  const saveLeaves = (newLeaves: LeaveRequest[]) => {
    setLeaveRequests(newLeaves);
    localStorage.setItem('unityspace_leaves', JSON.stringify(newLeaves));
  };

  const saveMeetings = (newMeetings: Meeting[]) => {
    setMeetings(newMeetings);
    localStorage.setItem('unityspace_meetings', JSON.stringify(newMeetings));
  };

  const saveNotifications = (newNotifs: Notification[]) => {
    setNotifications(newNotifs);
    localStorage.setItem('unityspace_notifications', JSON.stringify(newNotifs));
  };

  const handleLogAudit = (action: string, details: string, actor: Employee | null = currentUser) => {
    const newLog: AuditLog = {
      id: 'LOG_' + Date.now(),
      timestamp: nowTimestamp(),
      user: actor?.nickname || actor?.name || 'ผู้ใช้งานระบบ',
      role: actor?.role || '-',
      department: actor?.department || '',
      action,
      details
    };
    setAuditLogs((prev) => {
      const updated = [newLog, ...prev];
      localStorage.setItem('unityspace_audit_logs', JSON.stringify(updated));
      return updated;
    });
  };

  // 0. Employee Operations
  // Creates the employee directory row and its login credentials together via the API — there's
  // no localStorage-only fallback here (unlike documents/credentials) since a new account is
  // meaningless without a real, working login. Throws on failure so the caller can show why.
  const handleAddEmployee = async (employee: Employee & { password: string }) => {
    const created = await createEmployee(employee);
    const updated = [...employees, created];
    setEmployees(updated);
    localStorage.setItem('unityspace_employees', JSON.stringify(updated));
    handleLogAudit('ADD_EMPLOYEE', `สร้างบัญชีพนักงานใหม่: "${created.name}" (${created.department})`);
  };

  // currentUser re-syncs on its own once `employees` updates below — see the session-restore
  // effect above, which re-derives currentUser from the employees array on every change. Shared
  // by both the self-service "แก้ไขโปรไฟล์" form and the admin-only Employee Management edit form.
  const handleUpdateEmployee = async (
    id: string,
    updates: Partial<Pick<Employee, 'name' | 'nickname' | 'role' | 'avatar' | 'department' | 'division' | 'username' | 'accountType' | 'restrictedMenuIds' | 'phone' | 'address'>> & { password?: string }
  ) => {
    await updateEmployeeRemote(id, updates);
    // password is a login-only field, never part of the Employee shape kept in state/localStorage
    const { password: _password, ...employeeFields } = updates;
    const updated = employees.map(emp => (emp.id === id ? { ...emp, ...employeeFields } : emp));
    setEmployees(updated);
    localStorage.setItem('unityspace_employees', JSON.stringify(updated));
    const target = updated.find(emp => emp.id === id);
    if (target) handleLogAudit('UPDATE_EMPLOYEE', `แก้ไขข้อมูลพนักงาน: "${target.name}"`);
  };

  const handleDeleteEmployee = async (id: string) => {
    const target = employees.find(emp => emp.id === id);
    await deleteEmployeeRemote(id);
    const updated = employees.filter(emp => emp.id !== id);
    setEmployees(updated);
    localStorage.setItem('unityspace_employees', JSON.stringify(updated));
    if (target) handleLogAudit('DELETE_EMPLOYEE', `ลบบัญชีพนักงาน: "${target.name}" ออกจากระบบถาวร`);
  };

  // 0a. Project Operations (จัดการงานและโครงการ) — real `project` table, no localStorage layer.
  // Create awaits the API since the server generates both `id` and the human-facing "PRJ-NNN"
  // code, unlike credentials' fire-and-forget pattern where the client already owns the id.
  const handleAddProject = async (payload: CreateProjectPayload) => {
    const created = await createProject(payload);
    setProjects((prev) => [created, ...prev]);
    handleLogAudit('ADD_PROJECT', `สร้างโครงการใหม่: "${created.title}" (${created.code})`);
    return created;
  };

  // Awaited (not optimistic) — replaces the local row with the server's freshly re-formatted
  // version rather than merging raw `updates` straight into state, since an edit may submit raw
  // ISO dates while ProjectRow.startDate/endDate must stay Thai-formatted display text.
  const handleUpdateProject = async (id: string, updates: Partial<ProjectRow>) => {
    const updated = await updateProjectRemote(id, updates);
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    handleLogAudit('UPDATE_PROJECT', `แก้ไขโครงการ: "${updated.title}" (${updated.code})`);
  };

  const handleDeleteProject = async (id: string) => {
    const target = projects.find((p) => p.id === id);
    await deleteProjectRemote(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (target) handleLogAudit('DELETE_PROJECT', `ลบโครงการ: "${target.title}" (${target.code}) ออกจากระบบถาวร`);
  };

  // 0b. Org Chart Structure Operations (โครงสร้างองค์กร) — client-side/localStorage only, admin-
  // editable from Employee Management's โครงสร้างองค์กร tab. Renaming a division or section
  // cascades to every employee currently pointing at the old name so no one silently falls out of
  // the chart; deleting one does not — affected employees just show up as "ยังไม่ระบุฝ่าย" until
  // reassigned.
  const saveOrgDivisions = (updated: OrgDivisionData[]) => {
    setOrgDivisions(updated);
    localStorage.setItem('unityspace_org_divisions', JSON.stringify(updated));
  };

  const handleAddDivision = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || orgDivisions.some((d) => d.name === trimmed)) return;
    saveOrgDivisions([...orgDivisions, { name: trimmed, sections: [] }]);
    handleLogAudit('ADD_ORG_DIVISION', `เพิ่มฝ่ายใหม่: "${trimmed}"`);
  };

  const handleRenameDivision = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || orgDivisions.some((d) => d.name === trimmed)) return;
    saveOrgDivisions(orgDivisions.map((d) => (d.name === oldName ? { ...d, name: trimmed } : d)));
    employees.filter((emp) => emp.division === oldName).forEach((emp) => {
      handleUpdateEmployee(emp.id, { division: trimmed });
    });
    handleLogAudit('RENAME_ORG_DIVISION', `เปลี่ยนชื่อฝ่าย: "${oldName}" → "${trimmed}"`);
  };

  const handleDeleteDivision = (name: string) => {
    saveOrgDivisions(orgDivisions.filter((d) => d.name !== name));
    handleLogAudit('DELETE_ORG_DIVISION', `ลบฝ่าย: "${name}"`);
  };

  const handleAddSection = (divisionName: string, sectionName: string) => {
    const trimmed = sectionName.trim();
    if (!trimmed) return;
    saveOrgDivisions(orgDivisions.map((d) =>
      d.name === divisionName && !d.sections.includes(trimmed) ? { ...d, sections: [...d.sections, trimmed] } : d
    ));
    handleLogAudit('ADD_ORG_SECTION', `เพิ่มแผนกใหม่: "${trimmed}" ในฝ่าย "${divisionName}"`);
  };

  const handleRenameSection = (divisionName: string, oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    saveOrgDivisions(orgDivisions.map((d) =>
      d.name === divisionName
        ? { ...d, sections: d.sections.map((s) => (s === oldName ? trimmed : s)) }
        : d
    ));
    employees.filter((emp) => emp.department === oldName).forEach((emp) => {
      handleUpdateEmployee(emp.id, { department: trimmed });
    });
    handleLogAudit('RENAME_ORG_SECTION', `เปลี่ยนชื่อแผนก: "${oldName}" → "${trimmed}"`);
  };

  const handleDeleteSection = (divisionName: string, sectionName: string) => {
    saveOrgDivisions(orgDivisions.map((d) =>
      d.name === divisionName ? { ...d, sections: d.sections.filter((s) => s !== sectionName) } : d
    ));
    handleLogAudit('DELETE_ORG_SECTION', `ลบแผนก: "${sectionName}" ออกจากฝ่าย "${divisionName}"`);
  };

  // 1. Task Operations
  const handleSaveTask = (taskData: Partial<Task>) => {
    if (selectedTaskToEdit) {
      // Editing
      const updated = tasks.map(t => {
        if (t.id === selectedTaskToEdit.id) {
          return {
            ...t,
            ...taskData,
            progress: taskData.status === 'Completed' ? 100 : (taskData.progress ?? t.progress)
          } as Task;
        }
        return t;
      });
      saveTasks(updated);
      handleLogAudit('UPDATE_TASK', `แก้ไขงาน "${selectedTaskToEdit.title}" ของแผนงานโครงการเรียบร้อย`);
      setSelectedTaskToEdit(null);
    } else {
      // Creating
      const newTask: Task = {
        id: 'TASK_' + Date.now(),
        title: taskData.title || '',
        description: taskData.description || '',
        project: taskData.project || '',
        priority: taskData.priority || 'Medium',
        status: taskData.status || 'Not Started',
        progress: taskData.progress || 0,
        startDate: taskData.startDate || new Date().toISOString().split('T')[0],
        dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
        department: taskData.department || orgSections[0] || '',
        primaryOwnerId: taskData.primaryOwnerId || '',
        secondaryAssigneeIds: taskData.secondaryAssigneeIds || [],
        contributorIds: taskData.contributorIds || [],
        dependencies: taskData.dependencies || [],
        approvalStatus: 'None',
        recurringPattern: taskData.recurringPattern || 'None',
        linkedDocIds: taskData.linkedDocIds || [],
        handovers: []
      };

      const updated = [newTask, ...tasks];
      saveTasks(updated);

      // Trigger automatic notification for assigned owner
      const assignedEmp = employees.find(e => e.id === newTask.primaryOwnerId);
      if (assignedEmp) {
        const newNotif: Notification = {
          id: 'NOTIF_' + Date.now(),
          title: 'ได้รับมอบหมายงานใหม่ 📝',
          message: `คุณได้รับมอบหมายงาน "${newTask.title}" ในโครงการ "${newTask.project}"`,
          timestamp: nowTimestamp(),
          read: false,
          type: 'info'
        };
        saveNotifications([newNotif, ...notifications]);
      }

      handleLogAudit('CREATE_TASK', `สร้างหัวข้องานใหม่: "${newTask.title}" มอบหมายให้ ${assignedEmp?.name || 'ไม่ระบุ'}`);
    }
    setIsTaskModalOpen(false);
  };

  const handleDeleteTask = (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (window.confirm(`ยืนยันที่จะลบงาน "${taskToDelete?.title}" หรือไม่?`)) {
      const updated = tasks.filter(t => t.id !== id);
      saveTasks(updated);
      handleLogAudit('DELETE_TASK', `ลบงาน "${taskToDelete?.title}" ออกจากระบบถาวร`);
    }
  };

  // 2. Handover staged workflows
  const handleInitiateHandover = (
    taskId: string,
    fromUserId: string,
    toUserId: string,
    stageName: string,
    notes: string
  ) => {
    const handover: HandoverRecord = {
      id: 'HO_' + Date.now(),
      fromUserId,
      toUserId,
      stageName,
      notes,
      timestamp: nowTimestamp(),
      status: 'Pending'
    };

    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          handovers: [...t.handovers, handover]
        };
      }
      return t;
    });

    saveTasks(updated);

    // Create system notification for target receiver
    const receiver = employees.find(e => e.id === toUserId);
    const sender = employees.find(e => e.id === fromUserId);
    const newNotif: Notification = {
      id: 'NOTIF_HO_' + Date.now(),
      title: 'ต้องการอนุมัติส่งมอบงาน 👉',
      message: `${sender?.name} ได้ทำการส่งมอบสเตจงานเพื่อให้คุณดูแลต่อเพื่อยืนยันโปรโตคอล`,
      timestamp: nowTimestamp(),
      read: false,
      type: 'warning'
    };
    saveNotifications([newNotif, ...notifications]);

    handleLogAudit('INITIATE_HANDOVER', `เริ่มขั้นตอนส่งมอบงานย่อยจาก ${sender?.name} ไปยัง ${receiver?.name}`);
  };

  const handleApproveHandover = (
    taskId: string,
    handoverId: string,
    approved: boolean,
    notes: string
  ) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedHandovers = task.handovers.map(h => {
      if (h.id === handoverId) {
        return {
          ...h,
          status: approved ? 'Approved' : 'Rejected',
          approvedBy: 'สมศักดิ์ รักดี', // Simulated manager or supervisor
          approvalNotes: notes
        } as HandoverRecord;
      }
      return h;
    });

    const activeH = task.handovers.find(h => h.id === handoverId);

    // If approved, update the task's primary owner to the receiver
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          primaryOwnerId: approved && activeH ? activeH.toUserId : t.primaryOwnerId,
          handovers: updatedHandovers,
          // Set to Completed if final stage is approved, or boost progress
          progress: approved ? Math.max(t.progress, 85) : t.progress
        };
      }
      return t;
    });

    saveTasks(updated);

    // Create response notification for sender
    const sender = employees.find(e => e.id === activeH?.fromUserId);
    const newNotif: Notification = {
      id: 'NOTIF_HO_RESP_' + Date.now(),
      title: approved ? 'ส่งต่อสเตจงานอนุมัติแล้ว! ✅' : 'คำขอส่งต่องานถูกปฏิเสธ ❌',
      message: approved
        ? `ยินดีด้วย! การส่งมอบสเตจของคุณให้กับฝ่ายรับมอบช่วงผ่านการตรวจทานแล้ว`
        : `ข้อเสนอส่งมอบสเตจงานของคุณได้รับการตีกลับ: "${notes}"`,
      timestamp: nowTimestamp(),
      read: false,
      type: approved ? 'success' : 'warning'
    };
    saveNotifications([newNotif, ...notifications]);

    handleLogAudit('RESOLVE_HANDOVER', `${approved ? 'อนุมัติ' : 'ปฏิเสธ'} สเตจส่งมอบงานของ ${sender?.name}: "${notes}"`);
  };

  // 3. Document Operations
  const handleAddDocument = (newDoc: LinkedDoc) => {
    const updated = [newDoc, ...documents];
    saveDocs(updated);
    const actionLabel = newDoc.kind === 'folder' ? 'สร้างโฟลเดอร์' : newDoc.kind === 'file' ? 'อัปโหลดไฟล์' : 'แนบลิงก์เอกสาร';
    handleLogAudit('ADD_DOCUMENT', `${actionLabel}ใน Drive: "${newDoc.name}"`);
  };

  const handleEditDocument = (docId: string, updates: { name: string; url?: string; scope: LinkedDoc['scope']; team?: string }) => {
    const doc = documents.find(d => d.id === docId);
    saveDocs(documents.map(d => (d.id === docId ? { ...d, ...updates, team: updates.scope === 'ทีม' ? updates.team : undefined } : d)));
    if (doc) handleLogAudit('EDIT_DOCUMENT', `แก้ไข${doc.kind === 'folder' ? 'โฟลเดอร์' : doc.kind === 'file' ? 'ไฟล์' : 'ลิงก์'}: "${doc.name}"${updates.name !== doc.name ? ` → "${updates.name}"` : ''}`);
  };

  // Drag-and-drop move: reparents a document into a different folder. Guards against dropping a
  // folder into itself or into one of its own descendants, which would create a cycle.
  const handleMoveDocument = (docId: string, newParentId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc || docId === newParentId || doc.parentId === newParentId) return;

    if (doc.kind === 'folder') {
      const descendantIds = new Set<string>();
      let frontier = [docId];
      while (frontier.length > 0) {
        const children = documents.filter(d => d.parentId && frontier.includes(d.parentId)).map(d => d.id);
        children.forEach(id => descendantIds.add(id));
        frontier = children;
      }
      if (descendantIds.has(newParentId)) return;
    }

    const targetFolder = documents.find(d => d.id === newParentId);
    saveDocs(documents.map(d => (d.id === docId ? { ...d, parentId: newParentId } : d)));
    if (targetFolder) {
      const label = doc.kind === 'folder' ? 'โฟลเดอร์' : doc.kind === 'file' ? 'ไฟล์' : 'ลิงก์';
      handleLogAudit('MOVE_DOCUMENT', `ย้าย${label} "${doc.name}" ไปยังโฟลเดอร์ "${targetFolder.name}"`);
    }
  };

  // Deleting a folder cascades to everything nested inside it (files, links, and sub-folders),
  // walked breadth-first via parentId — otherwise those items would be silently orphaned.
  const handleDeleteDocument = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    const idsToDelete = new Set<string>([docId]);
    let frontier = [docId];
    while (frontier.length > 0) {
      const children = documents.filter(d => d.parentId && frontier.includes(d.parentId)).map(d => d.id);
      children.forEach(id => idsToDelete.add(id));
      frontier = children;
    }
    saveDocs(documents.filter(d => !idsToDelete.has(d.id)));
    if (doc) {
      const label = doc.kind === 'folder' ? `โฟลเดอร์ "${doc.name}" และเนื้อหาข้างในทั้งหมด` : `เอกสาร "${doc.name}"`;
      handleLogAudit('DELETE_DOCUMENT', `ลบ${label}ออกจาก Drive ถาวร`);
    }
  };

  // 4. Leave Operations
  const handleAddLeaveRequest = (newLeave: Omit<LeaveRequest, 'id'>) => {
    const request: LeaveRequest = {
      ...newLeave,
      id: 'LEAVE_' + Date.now()
    };
    const updated = [request, ...leaveRequests];
    saveLeaves(updated);
    handleLogAudit('APPLY_LEAVE', `พนักงาน ${newLeave.employeeName} ยื่นคำขอลาพักผ่อนแบบ ${newLeave.type}`);
  };

  const handleAddMeeting = (newMeeting: Omit<Meeting, 'id'>) => {
    const meeting: Meeting = {
      ...newMeeting,
      id: 'MEETING_' + Date.now()
    };
    saveMeetings([meeting, ...meetings]);
    handleLogAudit('CREATE_MEETING', `นัดประชุม "${newMeeting.title}" วันที่ ${newMeeting.date} เวลา ${newMeeting.startTime}`);
  };

  const handleApproveLeave = (leaveId: string, approved: boolean) => {
    const leave = leaveRequests.find(l => l.id === leaveId);
    if (!leave) return;

    const updated = leaveRequests.map(l => {
      if (l.id === leaveId) {
        return {
          ...l,
          status: approved ? 'Approved' : 'Rejected'
        } as LeaveRequest;
      }
      return l;
    });

    saveLeaves(updated);

    // Notify employee of approval
    const newNotif: Notification = {
      id: 'NOTIF_LEAVE_' + Date.now(),
      title: approved ? 'คำขออนุมัติลาผ่านแล้ว 🏖️' : 'คำขอลาถูกปฏิเสธ ❌',
      message: `ใบเสนอขอลาประเภท ${leave.type} ได้รับการพิจารณาเป็นที่เรียบร้อย`,
      timestamp: nowTimestamp(),
      read: false,
      type: approved ? 'success' : 'warning'
    };
    saveNotifications([newNotif, ...notifications]);

    handleLogAudit('RESOLVE_LEAVE', `${approved ? 'อนุมัติ' : 'ปฏิเสธ'} ใบลาของพนักงาน: ${leave.employeeName}`);
  };

  // 5. Credential Safe Operations
  // Local state/localStorage is updated immediately so the UI never blocks on the network;
  // the API call underneath is best-effort — if it fails (backend down, offline, etc.) the
  // change still stands locally and just doesn't reach the shared database yet.
  const handleAddCredential = (newItem: CredentialItem) => {
    saveCredentials([newItem, ...credentials]);
    createCredential(newItem).catch((err) => console.warn('Could not save credential to the API:', err));
  };

  const handleUpdateCredential = (id: string, updates: Partial<CredentialItem>) => {
    const updated = credentials.map(c => (c.id === id ? { ...c, ...updates } : c));
    saveCredentials(updated);
    const updatedItem = updated.find(c => c.id === id);
    if (updatedItem) {
      updateCredentialRemote(id, updatedItem).catch((err) => console.warn('Could not update credential in the API:', err));
    }
  };

  const handleDeleteCredential = (id: string) => {
    saveCredentials(credentials.filter(c => c.id !== id));
    deleteCredentialRemote(id).catch((err) => console.warn('Could not delete credential in the API:', err));
  };

  // Unread Count
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllNotificationsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const openAddTaskModal = () => {
    setSelectedTaskToEdit(null);
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setSelectedTaskToEdit(task);
    setIsTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setIsTaskModalOpen(false);
    setSelectedTaskToEdit(null);
  };

  const value: AppDataContextValue = {
    currentUser,
    isRestoringSession,
    handleLogin,
    handleLogout,
    employees,
    projects,
    tasks,
    documents,
    credentials,
    leaveRequests,
    meetings,
    notifications,
    auditLogs,
    unreadCount,
    isTaskModalOpen,
    selectedTaskToEdit,
    openAddTaskModal,
    openEditTaskModal,
    closeTaskModal,
    handleAddEmployee,
    handleUpdateEmployee,
    handleDeleteEmployee,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    handleSaveTask,
    handleDeleteTask,
    handleInitiateHandover,
    handleApproveHandover,
    handleAddDocument,
    handleEditDocument,
    handleDeleteDocument,
    handleMoveDocument,
    saveDocuments: saveDocs,
    docCurrentFolderId,
    setDocCurrentFolderId,
    taskSelectedProjectId,
    setTaskSelectedProjectId,
    handleAddLeaveRequest,
    handleApproveLeave,
    handleAddMeeting,
    handleAddCredential,
    handleUpdateCredential,
    handleDeleteCredential,
    handleLogAudit,
    handleMarkAllNotificationsRead,
    orgDivisions,
    orgSections,
    handleAddDivision,
    handleRenameDivision,
    handleDeleteDivision,
    handleAddSection,
    handleRenameSection,
    handleDeleteSection
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
