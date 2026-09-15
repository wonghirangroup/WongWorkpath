import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import {
  Employee,
  Task,
  LinkedDoc,
  CredentialItem,
  Meeting,
  Notification,
  AuditLog,
  HandoverRecord
} from '../types';
import { DEFAULT_ORG_DIVISIONS, OrgDivisionData } from '../data/orgStructure';
import {
  INITIAL_EMPLOYEES,
  INITIAL_DOCS,
  INITIAL_CREDENTIALS
} from '../data/mockData';
import { fetchEmployees, createEmployee, updateEmployeeRemote, deleteEmployeeRemote, fetchCredentials, createCredential, updateCredentialRemote, deleteCredentialRemote, fetchProjects, createProject, updateProjectRemote, deleteProjectRemote, CreateProjectPayload, fetchMeetings, createMeeting, updateMeetingRemote, deleteMeetingRemote, fetchProjectTasks, createProjectTask, updateProjectTaskRemote, deleteProjectTaskRemote, fetchProjectCustomStatuses, createProjectCustomStatus, deleteProjectCustomStatusRemote, fetchNotifications, createNotification, markNotificationRead, markAllNotificationsRead, CreateNotificationPayload } from '../lib/api';
import { nowTimestamp } from '../lib/datetime';
import type { ProjectRow, ProjectTaskItem, CustomProjectStatus } from '../components/projectBoard/types';
import { registerCustomStatusLabels } from '../components/projectBoard/statusMeta';

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
  projectTasks: ProjectTaskItem[];
  tasks: Task[];
  documents: LinkedDoc[];
  credentials: CredentialItem[];
  meetings: Meeting[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  unreadCount: number;

  // Task Modal — add-only now (see AppLayout.tsx: the Dashboard's "เพิ่มงาน" opens the real
  // AddTaskModal without a fixed project, not a dedicated old-Task editor).
  isTaskModalOpen: boolean;
  openAddTaskModal: () => void;
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
  customProjectStatuses: CustomProjectStatus[];
  handleAddCustomProjectStatus: (label: string) => Promise<CustomProjectStatus>;
  handleDeleteCustomProjectStatus: (id: string) => Promise<void>;
  handleAddProjectTask: (task: Omit<ProjectTaskItem, 'id'>) => Promise<ProjectTaskItem>;
  handleUpdateProjectTask: (id: string, updates: Partial<ProjectTaskItem>) => Promise<void>;
  handleDeleteProjectTask: (id: string) => Promise<void>;
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
  handleAddMeeting: (newMeeting: Omit<Meeting, 'id'>) => Promise<void>;
  handleUpdateMeeting: (id: string, updates: Partial<Meeting>, reason?: string) => Promise<void>;
  handleDeleteMeeting: (id: string) => Promise<void>;
  handleAddCredential: (newItem: CredentialItem) => void;
  handleUpdateCredential: (id: string, updates: Partial<CredentialItem>) => void;
  handleDeleteCredential: (id: string) => void;
  handleLogAudit: (action: string, details: string) => void;
  handleMarkAllNotificationsRead: () => void;
  handleMarkNotificationRead: (id: string) => void;
  // Newest unread notification(s) that arrived mid-session, for the corner NotificationToast —
  // null when nothing new is waiting to be announced.
  notificationToast: { notification: Notification; moreCount: number } | null;
  dismissNotificationToast: () => void;

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
  const [customProjectStatuses, setCustomProjectStatuses] = useState<CustomProjectStatus[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTaskItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<LinkedDoc[]>([]);
  const [docCurrentFolderId, setDocCurrentFolderId] = useState<string | null>(null);
  const [taskSelectedProjectId, setTaskSelectedProjectId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationToast, setNotificationToast] = useState<{ notification: Notification; moreCount: number } | null>(null);
  // Every notification id this session has already seen — null until the first fetch for the
  // logged-in user lands, which only records the existing backlog instead of announcing it.
  const seenNotificationIds = useRef<Set<string> | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [orgDivisions, setOrgDivisions] = useState<OrgDivisionData[]>(DEFAULT_ORG_DIVISIONS);
  const orgSections = useMemo(() => orgDivisions.flatMap((d) => d.sections), [orgDivisions]);

  // Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

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

  // Custom project statuses (see server/routes/project-custom-statuses.ts) — registered into
  // statusMeta.ts's label lookup as soon as they arrive, so every existing STATUS_LABEL[status]
  // call site across the app resolves a custom status's real label instead of its raw id, with
  // zero changes needed at any of those call sites.
  useEffect(() => {
    let cancelled = false;

    fetchProjectCustomStatuses()
      .then((statuses) => {
        if (cancelled) return;
        setCustomProjectStatuses(statuses);
        registerCustomStatusLabels(statuses);
      })
      .catch((err) => {
        console.warn('Could not load project custom statuses from the API:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Meetings live in the real `meeting` table (see server/routes/meetings.ts) — same no-
  // localStorage-layer treatment as projects. Old localStorage meetings from before this migration
  // are not carried over (they referenced the old mock project ids, which no longer exist anyway).
  useEffect(() => {
    let cancelled = false;

    fetchMeetings()
      .then((apiMeetings) => {
        if (cancelled) return;
        setMeetings(apiMeetings);
      })
      .catch((err) => {
        console.warn('Could not load meetings from the API:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Project tasks live in the real `project_task` table (see server/routes/project-tasks.ts) —
  // same no-localStorage-layer treatment as projects/meetings. Replaces the session-only
  // extraTasks state ProjectBoard.tsx used to hold, plus the old INITIAL_PROJECT_TASKS mock seed.
  useEffect(() => {
    let cancelled = false;

    fetchProjectTasks()
      .then((apiProjectTasks) => {
        if (cancelled) return;
        setProjectTasks(apiProjectTasks);
      })
      .catch((err) => {
        console.warn('Could not load project tasks from the API:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Notifications: fetched for the logged-in user and re-polled every 45s. There's no WebSocket
  // layer anywhere in this app, so a notification another user triggers (a task assigned to you,
  // a review result) only lands on this screen at the next poll — an explicitly accepted
  // trade-off rather than an oversight. Anything unread that turns up after this session's first
  // fetch is also announced once as a corner toast; logging in never replays the backlog.
  const announceNewNotifications = (incoming: Notification[]) => {
    const seen = seenNotificationIds.current;
    if (!seen) return;
    const fresh = incoming.filter((n) => !n.read && !seen.has(n.id));
    incoming.forEach((n) => seen.add(n.id));
    if (fresh.length > 0) setNotificationToast({ notification: fresh[0], moreCount: fresh.length - 1 });
  };

  useEffect(() => {
    seenNotificationIds.current = null;
    setNotificationToast(null);
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    let cancelled = false;
    const employeeId = currentUser.id;

    const refresh = () => {
      fetchNotifications(employeeId)
        .then((list) => {
          if (cancelled) return;
          if (seenNotificationIds.current) announceNewNotifications(list);
          else seenNotificationIds.current = new Set(list.map((n) => n.id));
          setNotifications(list);
        })
        .catch((err) => console.warn('Could not load notifications from the API:', err));
    };

    refresh();
    const interval = setInterval(refresh, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser]);

  // "Due soon / overdue / meeting coming up" aren't user actions anyone triggers, so unlike the
  // rest they're derived by scanning the data already loaded on this client. Each gets a
  // deterministic notification id so re-running this scan (on any data change, or in the next
  // session) collides on the primary key server-side instead of notifying the same thing twice —
  // see server/routes/notifications.ts. Only the logged-in user's own items are scanned: there's
  // no server-side scheduler, so nobody else's client can be reached from here.
  const scannedNotificationIds = useRef(new Set<string>());
  useEffect(() => {
    if (!currentUser) return;
    const me = currentUser.id;

    const attempt = (id: string, payload: Omit<CreateNotificationPayload, 'targetEmployeeId' | 'id'>) => {
      if (scannedNotificationIds.current.has(id)) return;
      scannedNotificationIds.current.add(id);
      pushNotification({ ...payload, id, targetEmployeeId: me });
    };

    projectTasks
      .filter((t) => t.status !== 'done' && t.assigneeEmployeeIds.includes(me) && t.daysUntilDue !== undefined)
      .forEach((t) => {
        const projectTitle = projects.find((p) => p.id === t.projectId)?.title ?? 'โครงการ';
        if (t.daysUntilDue! < 0) {
          attempt(`notif_overdue_${t.id}`, {
            title: 'งานเลยกำหนดส่งแล้ว',
            message: `งาน "${t.title}" ในโครงการ ${projectTitle} เลยกำหนดส่งแล้ว`,
            type: 'warning',
            linkType: 'project',
            linkId: t.projectId,
          });
        } else if (t.daysUntilDue! <= 2) {
          attempt(`notif_duesoon_${t.id}`, {
            title: 'งานใกล้ครบกำหนด',
            message: `งาน "${t.title}" ในโครงการ ${projectTitle} ครบกำหนดในอีก ${t.daysUntilDue} วัน`,
            type: 'warning',
            linkType: 'project',
            linkId: t.projectId,
          });
        }
      });

    const todayISO = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10);
    meetings
      .filter((m) => m.status !== 'cancelled' && m.attendeeIds.includes(me) && (m.date === todayISO || m.date === tomorrowISO))
      .forEach((m) => {
        attempt(`notif_meetingsoon_${m.id}`, {
          title: 'ใกล้ถึงเวลานัดประชุม',
          message: `"${m.title}" วันที่ ${m.date} เวลา ${m.startTime}`,
          type: 'info',
          linkType: m.projectId ? 'project' : undefined,
          linkId: m.projectId,
        });
      });
  }, [currentUser, projectTasks, meetings, projects]);

  // Initialize remaining domain data on mount (still localStorage/mock-only — no backend yet)
  useEffect(() => {
    const localTasks = localStorage.getItem('unityspace_tasks');
    const localDocs = localStorage.getItem('unityspace_docs');
    const localCredentials = localStorage.getItem('unityspace_credentials');
    const localLogs = localStorage.getItem('unityspace_audit_logs');
    const localOrgDivisions = localStorage.getItem('unityspace_org_divisions');

    // No longer seeding INITIAL_TASKS — the Gantt/Dashboard/Calendar pages should start empty
    // until real work is entered, not populated with demo data. A browser that already has the
    // old mock seed saved (from before this change) gets it cleared out here too, but only when
    // every single stored task is still one of the 5 known mock ids — the moment even one task
    // isn't (a real one the user added), nothing here is touched, erring on the side of never
    // deleting real work.
    const MOCK_TASK_IDS = new Set(['TASK01', 'TASK02', 'TASK03', 'TASK04', 'TASK05']);
    if (localTasks) {
      const parsedTasks = JSON.parse(localTasks);
      const isPureMockSeed = Array.isArray(parsedTasks) && parsedTasks.length > 0
        && parsedTasks.every((t: Task) => MOCK_TASK_IDS.has(t.id));
      if (isPureMockSeed) {
        setTasks([]);
        localStorage.setItem('unityspace_tasks', JSON.stringify([]));
      } else {
        setTasks(parsedTasks);
      }
    } else {
      setTasks([]);
      localStorage.setItem('unityspace_tasks', JSON.stringify([]));
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

    // The leave-request module was removed from the app entirely — drop its old mock data too.
    localStorage.removeItem('unityspace_leaves');

    // Notifications are real, per-employee DB rows now (server/routes/notifications.ts) — fetched
    // and polled in their own effect below, keyed to the logged-in user. Any leftover mock list
    // from the old localStorage-only version is cleared so it can't linger in the bell dropdown.
    localStorage.removeItem('unityspace_notifications');

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

  // Every notification is a real row owned by one target employee. Fire-and-forget: a failure to
  // notify must never fail (or roll back) the action that triggered it — the task really was
  // assigned, the meeting really was cancelled. The optimistic local prepend only applies when
  // the target is the user looking at this screen; everyone else picks it up on their next poll.
  const pushNotification = (payload: CreateNotificationPayload) => {
    createNotification(payload)
      .then((created) => {
        if (payload.targetEmployeeId === currentUser?.id) {
          announceNewNotifications([created]);
          setNotifications((prev) => (prev.some((n) => n.id === created.id) ? prev : [created, ...prev]));
        }
      })
      .catch((err) => console.warn('Could not create notification:', err));
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

  // Custom project statuses (StatusSummaryCards.tsx's widget settings) — registerCustomStatusLabels
  // is called again with the merged list right away so the new status's label is resolvable by
  // statusMeta.ts's STATUS_LABEL immediately, not just after the next full page load.
  const handleAddCustomProjectStatus = async (label: string) => {
    const created = await createProjectCustomStatus(label, currentUser?.id);
    setCustomProjectStatuses((prev) => {
      const next = [...prev, created];
      registerCustomStatusLabels(next);
      return next;
    });
    return created;
  };

  const handleDeleteCustomProjectStatus = async (id: string) => {
    await deleteProjectCustomStatusRemote(id);
    setCustomProjectStatuses((prev) => {
      const next = prev.filter((s) => s.id !== id);
      registerCustomStatusLabels(next);
      return next;
    });
  };

  const handleAddProjectTask = async (task: Omit<ProjectTaskItem, 'id'>) => {
    const created = await createProjectTask(task);
    setProjectTasks((prev) => [created, ...prev]);

    // Notify each assignee — except whoever created it, who doesn't need telling about their own
    // action. Random-suffixed (not deterministic) id: reassigning a task later should genuinely
    // produce a second notification, not silently collide with the first one.
    const projectTitle = projects.find((p) => p.id === created.projectId)?.title ?? 'โครงการ';
    created.assigneeEmployeeIds
      .filter((assigneeId) => assigneeId !== currentUser?.id)
      .forEach((assigneeId) => {
        pushNotification({
          targetEmployeeId: assigneeId,
          title: 'ได้รับมอบหมายงานใหม่',
          message: `คุณได้รับมอบหมายงาน "${created.title}" ในโครงการ ${projectTitle}`,
          type: 'info',
          linkType: 'project',
          linkId: created.projectId,
        });
      });

    return created;
  };

  // Same awaited-replace pattern as handleUpdateProject — an edit may submit raw ISO dates, which
  // must never leak into the Thai-formatted startDate/dueDate display fields.
  const handleUpdateProjectTask = async (id: string, updates: Partial<ProjectTaskItem>) => {
    const before = projectTasks.find((t) => t.id === id);
    const updated = await updateProjectTaskRemote(id, updates);
    setProjectTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));

    const projectTitle = projects.find((p) => p.id === updated.projectId)?.title ?? 'โครงการ';
    const notifyEach = (ids: string[] | undefined, payload: Omit<CreateNotificationPayload, 'targetEmployeeId'>) => {
      (ids ?? [])
        .filter((empId) => empId !== currentUser?.id)
        .forEach((empId) => pushNotification({ ...payload, targetEmployeeId: empId }));
    };

    // Submitted for review — the reviewers are the ones who need to act next.
    if (updates.status === 'review' && before?.status !== 'review') {
      notifyEach(updated.reviewerEmployeeIds, {
        title: 'มีงานรอตรวจ',
        message: `งาน "${updated.title}" ในโครงการ ${projectTitle} ถูกส่งมาให้ตรวจแล้ว`,
        type: 'warning',
        linkType: 'project',
        linkId: updated.projectId,
      });
    }

    // Review result — only when the task was actually sitting in review beforehand, so an
    // ordinary status edit (e.g. todo -> in_progress) never reads as "your work was reviewed".
    if (before?.status === 'review' && (updates.status === 'done' || updates.status === 'in_progress')) {
      const passed = updates.status === 'done';
      notifyEach(updated.assigneeEmployeeIds, {
        title: passed ? 'งานของคุณผ่านการตรวจแล้ว' : 'งานของคุณถูกตีกลับ',
        message: passed
          ? `งาน "${updated.title}" ในโครงการ ${projectTitle} ผ่านการตรวจเรียบร้อย`
          : `งาน "${updated.title}" ถูกตีกลับ: ${updates.reviewNote || 'ไม่ได้ระบุเหตุผล'}`,
        type: passed ? 'success' : 'warning',
        linkType: 'project',
        linkId: updated.projectId,
      });
    }
  };

  const handleDeleteProjectTask = async (id: string) => {
    await deleteProjectTaskRemote(id);
    setProjectTasks((prev) => prev.filter((t) => t.id !== id));
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
    pushNotification({
      targetEmployeeId: toUserId,
      title: 'ต้องการอนุมัติส่งมอบงาน',
      message: `${sender?.name} ได้ทำการส่งมอบสเตจงานเพื่อให้คุณดูแลต่อเพื่อยืนยันโปรโตคอล`,
      type: 'warning',
    });

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
    if (activeH?.fromUserId) {
      pushNotification({
        targetEmployeeId: activeH.fromUserId,
        title: approved ? 'ส่งต่อสเตจงานอนุมัติแล้ว' : 'คำขอส่งต่องานถูกปฏิเสธ',
        message: approved
          ? 'ยินดีด้วย! การส่งมอบสเตจของคุณให้กับฝ่ายรับมอบช่วงผ่านการตรวจทานแล้ว'
          : `ข้อเสนอส่งมอบสเตจงานของคุณได้รับการตีกลับ: "${notes}"`,
        type: approved ? 'success' : 'warning',
      });
    }

    handleLogAudit('RESOLVE_HANDOVER', `${approved ? 'อนุมัติ' : 'ปฏิเสธ'} สเตจส่งมอบงานของ ${sender?.name}: "${notes}"`);
  };

  // 3. Document Operations
  // Functional update (not `[newDoc, ...documents]` off the closed-over `documents` variable) —
  // callers like SubmitTaskModal call this once per attachment in a loop (a file, then a link),
  // and building off the stale closure meant every call but the last silently overwrote the ones
  // before it, since none of them saw each other's additions within the same render cycle.
  const handleAddDocument = (newDoc: LinkedDoc) => {
    setDocuments((prev) => {
      const updated = [newDoc, ...prev];
      localStorage.setItem('unityspace_docs', JSON.stringify(updated));
      return updated;
    });
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

  const handleAddMeeting = async (newMeeting: Omit<Meeting, 'id'>) => {
    const created = await createMeeting(newMeeting);
    setMeetings((prev) => [created, ...prev]);
    handleLogAudit('CREATE_MEETING', `นัดประชุม "${created.title}" วันที่ ${created.date} เวลา ${created.startTime}`);

    created.attendeeIds
      .filter((attendeeId) => attendeeId !== currentUser?.id)
      .forEach((attendeeId) => {
        pushNotification({
          targetEmployeeId: attendeeId,
          title: 'มีนัดประชุมใหม่',
          message: `"${created.title}" วันที่ ${created.date} เวลา ${created.startTime}`,
          type: 'info',
          linkType: created.projectId ? 'project' : undefined,
          linkId: created.projectId,
        });
      });
  };

  // `reason` covers both edit ("แก้ไขสถานที่/ลิงก์") and cancel — cancel's own reason already
  // lands in updates.cancellationReason on the row itself, but logging it here too means both
  // kinds of change show up the same way in the audit trail (บันทึกกิจกรรม), not just cancels.
  const handleUpdateMeeting = async (id: string, updates: Partial<Meeting>, reason?: string) => {
    const updated = await updateMeetingRemote(id, updates);
    setMeetings((prev) => prev.map((m) => (m.id === id ? updated : m)));
    if (reason) {
      const action = updates.status === 'cancelled' ? 'CANCEL_MEETING' : 'UPDATE_MEETING';
      const verb = updates.status === 'cancelled' ? 'ยกเลิกการประชุม' : 'แก้ไขการประชุม';
      handleLogAudit(action, `${verb}: "${updated.title}" — เหตุผล: ${reason}`);
    }

    if (updates.status === 'cancelled') {
      updated.attendeeIds
        .filter((attendeeId) => attendeeId !== currentUser?.id)
        .forEach((attendeeId) => {
          pushNotification({
            targetEmployeeId: attendeeId,
            title: 'การประชุมถูกยกเลิก',
            message: `"${updated.title}" วันที่ ${updated.date} ถูกยกเลิก: ${updated.cancellationReason || 'ไม่ได้ระบุเหตุผล'}`,
            type: 'warning',
            linkType: updated.projectId ? 'project' : undefined,
            linkId: updated.projectId,
          });
        });
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    await deleteMeetingRemote(id);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
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

  // Optimistic locally, persisted server-side — the bell badge shouldn't wait on a round trip.
  const handleMarkAllNotificationsRead = () => {
    if (!currentUser) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsRead(currentUser.id).catch((err) => console.warn('Could not mark notifications read:', err));
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    markNotificationRead(id).catch((err) => console.warn('Could not mark notification read:', err));
  };

  const dismissNotificationToast = () => setNotificationToast(null);

  const openAddTaskModal = () => {
    setIsTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setIsTaskModalOpen(false);
  };

  const value: AppDataContextValue = {
    currentUser,
    isRestoringSession,
    handleLogin,
    handleLogout,
    employees,
    projects,
    projectTasks,
    tasks,
    documents,
    credentials,
    meetings,
    notifications,
    auditLogs,
    unreadCount,
    isTaskModalOpen,
    openAddTaskModal,
    closeTaskModal,
    handleAddEmployee,
    handleUpdateEmployee,
    handleDeleteEmployee,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    customProjectStatuses,
    handleAddCustomProjectStatus,
    handleDeleteCustomProjectStatus,
    handleAddProjectTask,
    handleUpdateProjectTask,
    handleDeleteProjectTask,
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
    handleAddMeeting,
    handleUpdateMeeting,
    handleDeleteMeeting,
    handleAddCredential,
    handleUpdateCredential,
    handleDeleteCredential,
    handleLogAudit,
    handleMarkAllNotificationsRead,
    handleMarkNotificationRead,
    notificationToast,
    dismissNotificationToast,
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
