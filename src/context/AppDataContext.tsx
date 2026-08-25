import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Employee,
  Task,
  LinkedDoc,
  CredentialItem,
  LeaveRequest,
  Notification,
  AuditLog,
  HandoverRecord,
  Department
} from '../types';
import {
  INITIAL_EMPLOYEES,
  INITIAL_DOCS,
  INITIAL_TASKS,
  INITIAL_CREDENTIALS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_NOTIFICATIONS
} from '../data/mockData';
import { fetchEmployees, createEmployee, updateEmployeeRemote, fetchCredentials, createCredential, updateCredentialRemote, deleteCredentialRemote } from '../lib/api';

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
  tasks: Task[];
  documents: LinkedDoc[];
  credentials: CredentialItem[];
  leaveRequests: LeaveRequest[];
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
  handleUpdateEmployee: (id: string, updates: { name: string; role: string; avatar?: string }) => Promise<void>;
  handleSaveTask: (taskData: Partial<Task>) => void;
  handleDeleteTask: (id: string) => void;
  handleInitiateHandover: (taskId: string, fromUserId: string, toUserId: string, stageName: string, notes: string) => void;
  handleApproveHandover: (taskId: string, handoverId: string, approved: boolean, notes: string) => void;
  handleAddDocument: (newDoc: LinkedDoc) => void;
  handleEditDocument: (docId: string, updates: { name: string; url?: string; scope: LinkedDoc['scope']; team?: Department }) => void;
  handleDeleteDocument: (docId: string) => void;
  handleMoveDocument: (docId: string, newParentId: string) => void;
  saveDocuments: (newDocs: LinkedDoc[]) => void;
  // Which Drive folder is currently open — shared with AppLayout so the Header can render it as
  // a breadcrumb title ("เอกสาร Drive > Grow Store") instead of the page's normal static title.
  docCurrentFolderId: string | null;
  setDocCurrentFolderId: (id: string | null) => void;
  handleAddLeaveRequest: (newLeave: Omit<LeaveRequest, 'id'>) => void;
  handleApproveLeave: (leaveId: string, approved: boolean) => void;
  handleAddCredential: (newItem: CredentialItem) => void;
  handleUpdateCredential: (id: string, updates: Partial<CredentialItem>) => void;
  handleDeleteCredential: (id: string) => void;
  handleLogAudit: (action: string, details: string) => void;
  handleMarkAllNotificationsRead: () => void;
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<LinkedDoc[]>([]);
  const [docCurrentFolderId, setDocCurrentFolderId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

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

  // Initialize remaining domain data on mount (still localStorage/mock-only — no backend yet)
  useEffect(() => {
    const localTasks = localStorage.getItem('unityspace_tasks');
    const localDocs = localStorage.getItem('unityspace_docs');
    const localCredentials = localStorage.getItem('unityspace_credentials');
    const localLeaves = localStorage.getItem('unityspace_leaves');
    const localNotifications = localStorage.getItem('unityspace_notifications');
    const localLogs = localStorage.getItem('unityspace_audit_logs');

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
          action: 'SYSTEM_STARTUP',
          details: 'เริ่มต้นระบบจัดการแผนงานและข้อมูลความปลอดภัย UnitySpace สมบูรณ์แบบ'
        }
      ];
      setAuditLogs(initialLogs);
      localStorage.setItem('unityspace_audit_logs', JSON.stringify(initialLogs));
    }
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
    handleLogAudit('LOGIN', `${employee.name} เข้าสู่ระบบ`);
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

  const saveNotifications = (newNotifs: Notification[]) => {
    setNotifications(newNotifs);
    localStorage.setItem('unityspace_notifications', JSON.stringify(newNotifs));
  };

  const handleLogAudit = (action: string, details: string) => {
    const newLog: AuditLog = {
      id: 'LOG_' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      user: 'ผู้ใช้งานระบบ',
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
  // effect above, which re-derives currentUser from the employees array on every change.
  const handleUpdateEmployee = async (id: string, updates: { name: string; role: string; avatar?: string }) => {
    await updateEmployeeRemote(id, updates);
    const updated = employees.map(emp => (emp.id === id ? { ...emp, ...updates } : emp));
    setEmployees(updated);
    localStorage.setItem('unityspace_employees', JSON.stringify(updated));
    handleLogAudit('UPDATE_PROFILE', `แก้ไขโปรไฟล์ของ "${updates.name}"`);
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
        department: taskData.department || 'IT',
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
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
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
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
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
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
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
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
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

  const handleEditDocument = (docId: string, updates: { name: string; url?: string; scope: LinkedDoc['scope']; team?: Department }) => {
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
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
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
    tasks,
    documents,
    credentials,
    leaveRequests,
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
    handleAddLeaveRequest,
    handleApproveLeave,
    handleAddCredential,
    handleUpdateCredential,
    handleDeleteCredential,
    handleLogAudit,
    handleMarkAllNotificationsRead
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
