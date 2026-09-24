import { createContext, useCallback, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import {
  Employee,
  LinkedDoc,
  CredentialItem,
  Meeting,
  Notification,
  AuditLog,
} from '../types';
import { DEFAULT_ORG_DIVISIONS, OrgDivisionData } from '../data/orgStructure';
import { ApiError, fetchCurrentUser, getAuthToken, clearAuthToken, setSessionExpiredHandler, fetchEmployees, createEmployee, updateEmployeeRemote, changeSelfPassword, deleteEmployeeRemote, fetchCredentials, createCredential, updateCredentialRemote, deleteCredentialRemote, fetchProjects, createProject, updateProjectRemote, deleteProjectRemote, CreateProjectPayload, fetchMeetings, createMeeting, updateMeetingRemote, fetchProjectTasks, createProjectTask, updateProjectTaskRemote, deleteProjectTaskRemote, fetchProjectCustomStatuses, createProjectCustomStatus, deleteProjectCustomStatusRemote, fetchNotifications, createNotification, markNotificationRead, markAllNotificationsRead, CreateNotificationPayload, fetchChangeRequests, createChangeRequest, decideChangeRequest, ChangeRequest, fetchDocuments, createDocument, updateDocumentRemote, deleteDocumentRemote, fetchOrgStructure, addOrgDivision, renameOrgDivision, deleteOrgDivision, addOrgSection, renameOrgSection, deleteOrgSection, fetchAuditLogs, createAuditLog, fetchProjectCustomTypes, createProjectCustomType } from '../lib/api';
import { nowTimestamp, formatThaiDateShort } from '../lib/datetime';
import type { ProjectRow, ProjectTaskItem, CustomProjectStatus, CustomProjectType } from '../components/projectBoard/types';
import { registerCustomStatusLabels, registerCustomTypeLabels } from '../components/projectBoard/statusMeta';

// Client-side mirror of the server's own recomputeAncestorStatuses (server/routes/project-tasks.ts)
// — a task with 1+ subtasks ("หัวข้อ" is just this same task type under a different creation-time
// label) has its status fully derived from them: 'in_progress' the moment it has any subtask that
// isn't 'done', 'done' only once every one of them is. Mirrored here purely so the UI reflects a
// just-created/just-changed/just-deleted subtask's effect on its parent(s) instantly instead of
// waiting for a full reload to notice what the server already recomputed — the server write is
// still the actual source of truth. Walks upward, stopping the moment a level's derived status
// doesn't actually need to change (a task with zero subtasks — e.g. its last one was just deleted
// — is left exactly as it is, freely editable again).
function recomputeAncestorTaskStatuses(list: ProjectTaskItem[], startParentId: string): ProjectTaskItem[] {
  let current = list;
  let parentId: string | undefined = startParentId;
  while (parentId) {
    const siblings = current.filter((t) => t.parentTaskId === parentId);
    if (siblings.length === 0) break;
    const allDone = siblings.every((t) => t.status === 'done');
    const nextStatus: ProjectTaskItem['status'] = allDone ? 'done' : 'in_progress';
    const parent = current.find((t) => t.id === parentId);
    if (!parent || parent.status === nextStatus) break;
    const resolvedParentId: string = parentId;
    current = current.map((t) => (t.id === resolvedParentId ? { ...t, status: nextStatus } : t));
    parentId = parent.parentTaskId;
  }
  return current;
}

// Loads one domain's data when someone logs in (and again for the next person), ignoring a response
// that arrives after they've logged out or been replaced. `reset` empties the state on logout so the
// next person never glimpses the previous one's data.
function useLoadOnLogin<T>(
  userId: string | null,
  label: string,
  load: () => Promise<T>,
  apply: (data: T) => void,
  reset: () => void,
  onFailure: () => void
) {
  useEffect(() => {
    if (!userId) {
      reset();
      return;
    }
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) apply(data);
      })
      .catch((err) => {
        console.warn(`Could not load ${label} from the API:`, err);
        if (!cancelled) onFailure();
      });
    return () => {
      cancelled = true;
    };
    // Only a change of person should reload — the callbacks are recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
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
  documents: LinkedDoc[];
  credentials: CredentialItem[];
  meetings: Meeting[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  unreadCount: number;

  // Mutations
  handleAddEmployee: (employee: Employee & { password: string }) => Promise<void>;
  handleUpdateEmployee: (
    id: string,
    updates: Partial<Pick<Employee, 'name' | 'nickname' | 'role' | 'avatar' | 'department' | 'division' | 'username' | 'accountType' | 'restrictedMenuIds' | 'phone' | 'address' | 'email' | 'mutedNotificationCategories'>> & { password?: string }
  ) => Promise<void>;
  handleDeleteEmployee: (id: string, reason: string) => Promise<void>;
  handleChangeSelfPassword: (password: string) => Promise<void>;
  handleRefreshAccountData: () => Promise<void>;
  handleAddProject: (payload: CreateProjectPayload) => Promise<ProjectRow>;
  handleUpdateProject: (id: string, updates: Partial<ProjectRow>) => Promise<void>;
  handleDeleteProject: (id: string) => Promise<void>;
  customProjectStatuses: CustomProjectStatus[];
  handleAddCustomProjectStatus: (label: string) => Promise<CustomProjectStatus>;
  handleDeleteCustomProjectStatus: (id: string) => Promise<void>;
  customProjectTypes: CustomProjectType[];
  handleAddCustomProjectType: (label: string, abbreviation: string) => Promise<CustomProjectType>;
  handleAddProjectTask: (task: Omit<ProjectTaskItem, 'id'>) => Promise<ProjectTaskItem>;
  handleUpdateProjectTask: (id: string, updates: Partial<ProjectTaskItem>) => Promise<void>;
  handleDeleteProjectTask: (id: string) => Promise<void>;
  changeRequests: ChangeRequest[];
  handleRequestChange: (
    entityType: 'project' | 'project_task' | 'employee',
    entityId: string,
    requestType: 'edit' | 'delete',
    proposedChanges: Record<string, unknown> | undefined,
    reason: string
  ) => Promise<void>;
  handleDecideChangeRequest: (requestId: string, decision: 'approve' | 'reject', note?: string) => Promise<void>;
  handleAddDocument: (newDoc: Omit<LinkedDoc, 'id'>) => Promise<LinkedDoc>;
  handleEditDocument: (docId: string, updates: { name: string; url?: string; scope: LinkedDoc['scope']; projectId?: string }) => Promise<void>;
  handleDeleteDocument: (docId: string) => Promise<void>;
  handleMoveDocument: (docId: string, newParentId: string) => Promise<void>;
  // Which Drive folder is currently open — shared with AppLayout so the Header can render it as
  // a breadcrumb title ("เอกสาร Drive > Grow Store") instead of the page's normal static title.
  docCurrentFolderId: string | null;
  setDocCurrentFolderId: (id: string | null) => void;
  // Which project's detail view is currently open on the Tasks page — shared with AppLayout so
  // the Header can render it as a breadcrumb subtitle ("จัดการงานและโครงการ > Grow store") instead
  // of the page's normal static subtitle, same pattern as docCurrentFolderId above.
  taskSelectedProjectId: string | null;
  setTaskSelectedProjectId: (id: string | null) => void;
  // Which tab ProjectDetail should open on the next time it mounts for taskSelectedProjectId —
  // set alongside it by anywhere that deep-links into a specific project (e.g. clicking a meeting
  // on the Calendar page opens straight to "การประชุม" instead of always landing on "ภาพรวม").
  // Consumed once (read into ProjectDetail's own initial state) and cleared by ProjectBoard.
  taskSelectedTab: string | null;
  setTaskSelectedTab: (tab: string | null) => void;
  handleAddMeeting: (newMeeting: Omit<Meeting, 'id'>) => Promise<void>;
  handleUpdateMeeting: (id: string, updates: Partial<Meeting>, reason?: string) => Promise<void>;
  handleAddCredential: (newItem: CredentialItem) => Promise<void>;
  handleUpdateCredential: (id: string, updates: Partial<CredentialItem>) => Promise<void>;
  handleDeleteCredential: (id: string) => Promise<void>;
  handleLogAudit: (action: string, details: string) => void;
  handleMarkAllNotificationsRead: () => void;
  handleMarkNotificationRead: (id: string) => void;
  // Newest unread notification(s) that arrived mid-session, for the corner NotificationToast —
  // null when nothing new is waiting to be announced.
  notificationToast: { notification: Notification; moreCount: number } | null;
  dismissNotificationToast: () => void;
  // App-wide "something went wrong" message (failed data load, refused change) — see AppErrorToast.
  appError: string | null;
  dismissAppError: () => void;

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
  const [customProjectTypes, setCustomProjectTypes] = useState<CustomProjectType[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTaskItem[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [documents, setDocuments] = useState<LinkedDoc[]>([]);
  const [docCurrentFolderId, setDocCurrentFolderId] = useState<string | null>(null);
  const [taskSelectedProjectId, setTaskSelectedProjectId] = useState<string | null>(null);
  const [taskSelectedTab, setTaskSelectedTab] = useState<string | null>(null);
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

  // Every API call below needs a session, so all loading waits for a logged-in user and re-runs when
  // a different person signs in (which also wipes the previous person's data first). `visibilityKey`
  // covers the one field that changes what the server returns for the *same* person — becoming or
  // ceasing to be ผู้บริหาร widens/narrows the docs and vault they may see.
  const userId = currentUser?.id ?? null;
  const visibilityKey = `${userId ?? ''}:${currentUser?.accountType ?? ''}`;

  // Failures the person would otherwise never learn about (data that didn't load, a change the
  // server refused) surface as one toast instead of a silent console warning.
  const [appError, setAppError] = useState<string | null>(null);
  const dismissAppError = useCallback(() => setAppError(null), []);
  const reportLoadFailure = useCallback(() => setAppError('โหลดข้อมูลบางส่วนไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง หากยังไม่หายให้แจ้งผู้ดูแลระบบ'), []);
  const reportActionFailure = (err: unknown, fallback: string) => setAppError(err instanceof ApiError ? err.message : fallback);
  // A new login starts with a clean slate — an error from the previous session shouldn't linger.
  useEffect(() => setAppError(null), [userId]);

  // Employees live in the real `employee` table (see server/routes/employees.ts). Nothing is cached
  // in localStorage any more — the directory holds phone numbers and addresses, and the login
  // response already hands back the signed-in employee, so there is nothing to show before this lands.
  useEffect(() => {
    if (!userId) {
      setEmployees([]);
      return;
    }
    let cancelled = false;
    fetchEmployees()
      .then((apiEmployees) => {
        if (!cancelled) setEmployees(apiEmployees);
      })
      .catch((err) => {
        console.warn('Could not load employees from the API:', err);
        if (!cancelled) reportLoadFailure();
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Keeps `currentUser` in step with the directory: an edit to your own profile (or a role change an
  // admin makes) arrives via `employees`, and everything derived from currentUser should follow.
  useEffect(() => {
    setCurrentUser((prev) => (prev ? employees.find((emp) => emp.id === prev.id) ?? prev : prev));
  }, [employees]);

  // Credential Vault items live in the real `credential` table (see server/routes/credentials.ts);
  // visibility is server-enforced there (personal/team/project scoping by real employee id, not
  // the old client-side display-name match) — same actor-scoped shape as the documents fetch below.
  useEffect(() => {
    if (!userId) {
      setCredentials([]);
      return;
    }
    let cancelled = false;

    fetchCredentials(userId)
      .then((apiCredentials) => {
        if (cancelled) return;
        setCredentials(apiCredentials);
      })
      .catch((err) => {
        console.warn('Could not load credentials from the API:', err);
        if (!cancelled) reportLoadFailure();
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibilityKey]);

  // Projects live in the real `project` table (see server/routes/projects.ts) with no
  // localStorage layer at all.
  useLoadOnLogin(userId, 'projects', fetchProjects, setProjects, () => setProjects([]), reportLoadFailure);

  // Custom project statuses (see server/routes/project-custom-statuses.ts) — registered into
  // statusMeta.ts's label lookup as soon as they arrive, so every existing STATUS_LABEL[status]
  // call site across the app resolves a custom status's real label instead of its raw id, with
  // zero changes needed at any of those call sites.
  useLoadOnLogin(
    userId,
    'project custom statuses',
    fetchProjectCustomStatuses,
    (statuses) => {
      setCustomProjectStatuses(statuses);
      registerCustomStatusLabels(statuses);
    },
    () => setCustomProjectStatuses([]),
    reportLoadFailure
  );

  // Custom project types (see server/routes/project-custom-types.ts) — same registration
  // pattern as custom project statuses above, into statusMeta.ts's PROJECT_TYPE_META instead.
  useLoadOnLogin(
    userId,
    'project custom types',
    fetchProjectCustomTypes,
    (types) => {
      setCustomProjectTypes(types);
      registerCustomTypeLabels(types);
    },
    () => setCustomProjectTypes([]),
    reportLoadFailure
  );

  // Meetings live in the real `meeting` table (see server/routes/meetings.ts).
  useLoadOnLogin(userId, 'meetings', fetchMeetings, setMeetings, () => setMeetings([]), reportLoadFailure);

  // Project tasks live in the real `project_task` table (see server/routes/project-tasks.ts).
  useLoadOnLogin(userId, 'project tasks', fetchProjectTasks, setProjectTasks, () => setProjectTasks([]), reportLoadFailure);

  // Pending/decided edit-or-delete requests (see server/routes/change-requests.ts) — loaded
  // whole, same as projects/tasks, since this is a small internal-tool dataset. Powers both the
  // "is a request already pending here" check before opening an edit/delete form and
  // ProjectDetail's owner-facing pending-requests panel.
  useLoadOnLogin(userId, 'change requests', fetchChangeRequests, setChangeRequests, () => setChangeRequests([]), reportLoadFailure);

  // Documents (เอกสาร Drive) live in the real `document` table now. Visibility is per-user (a
  // 'ส่วนตัว' doc only shows to its creator; a 'โครงการ' doc only to that project's owners/members),
  // so this re-fetches whenever a different person signs in — login as someone else must not keep
  // showing the previous person's personal docs.
  useEffect(() => {
    if (!userId) {
      setDocuments([]);
      return;
    }
    let cancelled = false;
    fetchDocuments(userId)
      .then((docs) => {
        if (cancelled) return;
        setDocuments(docs);
      })
      .catch((err) => {
        console.warn('Could not load documents from the API:', err);
        if (!cancelled) reportLoadFailure();
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibilityKey]);

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
    if (!userId) {
      setNotifications([]);
      return;
    }
    let cancelled = false;
    const employeeId = userId;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
            category: 'deadline',
            message: `งาน "${t.title}" ในโครงการ ${projectTitle} เลยกำหนดส่งแล้ว`,
            type: 'warning',
            linkType: 'project',
            linkId: t.projectId,
          });
        } else if (t.daysUntilDue! <= 2) {
          attempt(`notif_duesoon_${t.id}`, {
            title: 'งานใกล้ครบกำหนด',
            category: 'deadline',
            message: `งาน "${t.title}" ในโครงการ ${projectTitle} ครบกำหนดในอีก ${t.daysUntilDue} วัน`,
            type: 'warning',
            linkType: 'project',
            linkId: t.projectId,
          });
        }
      });

    // Local calendar dates, not toISOString() (which is UTC — between midnight and 07:00 in Thailand
    // it still reads yesterday, so "today's" and "tomorrow's" meetings were off by a day).
    const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayISO = isoOf(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = isoOf(tomorrow);
    meetings
      .filter((m) => m.status !== 'cancelled' && m.attendeeIds.includes(me) && (m.date === todayISO || m.date === tomorrowISO))
      .forEach((m) => {
        attempt(`notif_meetingsoon_${m.id}`, {
          title: 'ใกล้ถึงเวลานัดประชุม',
          category: 'meeting',
          message: `"${m.title}" วันที่ ${formatThaiDateShort(m.date)} เวลา ${m.startTime}`,
          type: 'info',
          linkType: m.projectId ? 'project' : undefined,
          linkId: m.projectId,
        });
      });
  }, [currentUser, projectTasks, meetings, projects]);

  // One-time cleanup of domains that used to live in localStorage and are now real, shared
  // backend tables (or, for unityspace_tasks/unityspace_leaves/unityspace_notifications, are gone
  // entirely) — drops the old keys from any browser that still has them so they can't linger
  // unused. The actual data for the still-live domains now comes from the API, in their own
  // effects below.
  useEffect(() => {
    localStorage.removeItem('unityspace_tasks');
    localStorage.removeItem('unityspace_leaves');
    localStorage.removeItem('unityspace_notifications');
    localStorage.removeItem('unityspace_audit_logs');
    localStorage.removeItem('unityspace_org_divisions');
    // Replaced by the signed session token (see lib/api.ts) — the bare user id proved nothing — and
    // the employee directory is no longer mirrored into the browser.
    localStorage.removeItem('unityspace_current_user_id');
    localStorage.removeItem('unityspace_employees');
    // The one-off "recover documents that used to live in this browser" upload has long since run
    // on every device in use; drop what it left behind.
    localStorage.removeItem('unityspace_docs');
    localStorage.removeItem('unityspace_docs_migrated_v1');
  }, []);

  // บันทึกกิจกรรม (audit log) — a real, shared table (server/routes/audit-logs.ts), so two employees
  // on two different computers see the same history. Only admin-level accounts receive any rows.
  useLoadOnLogin(userId, 'audit logs', fetchAuditLogs, setAuditLogs, () => setAuditLogs([]), reportLoadFailure);

  // โครงสร้างองค์กร (ฝ่าย/แผนก) — a real, shared table (server/routes/org-structure.ts). Falls back
  // to keeping the DEFAULT_ORG_DIVISIONS the state started with if the API is unreachable.
  useLoadOnLogin(userId, 'org structure', fetchOrgStructure, setOrgDivisions, () => setOrgDivisions(DEFAULT_ORG_DIVISIONS), reportLoadFailure);

  // Restore the login session after a page reload: the stored token is checked with the server (an
  // expired or revoked one is dropped) rather than trusting a user id saved in the browser.
  useEffect(() => {
    if (!getAuthToken()) {
      setIsRestoringSession(false);
      return;
    }
    let cancelled = false;
    fetchCurrentUser()
      .then((employee) => {
        if (!cancelled) setCurrentUser(employee);
      })
      .catch((err) => console.warn('Could not restore the login session:', err))
      .finally(() => {
        if (!cancelled) setIsRestoringSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 from any call (token expired, account removed) drops the user back to the login page.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      try {
        sessionStorage.setItem('unityspace_session_expired', '1');
      } catch {
        /* storage blocked — the login page just won't explain why */
      }
      setCurrentUser(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const handleLogin = (employee: Employee) => {
    setCurrentUser(employee);
    handleLogAudit('LOGIN', `${employee.name} เข้าสู่ระบบ`, employee);
  };

  const handleLogout = () => {
    // The audit call reads the token synchronously as it starts, so it still goes out signed even
    // though the token is cleared on the next line.
    if (currentUser) handleLogAudit('LOGOUT', `${currentUser.name} ออกจากระบบ`);
    clearAuthToken();
    setCurrentUser(null);
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

  // Prepends locally right away so the Log tab still feels instant, then persists to the real
  // table in the background — same fire-and-forget shape as pushNotification above. A failure to
  // save server-side never blocks or rolls back the action that triggered this log entry.
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
    setAuditLogs((prev) => [newLog, ...prev]);
    createAuditLog(newLog).catch((err) => console.warn('Could not save audit log entry:', err));
  };

  // 0. Employee Operations
  // Creates the employee directory row and its login credentials together via the API — there's
  // no localStorage-only fallback here (unlike documents/credentials) since a new account is
  // meaningless without a real, working login. Throws on failure so the caller can show why.
  const handleAddEmployee = async (employee: Employee & { password: string }) => {
    const created = await createEmployee(employee);
    const updated = [...employees, created];
    setEmployees(updated);
    handleLogAudit('ADD_EMPLOYEE', `สร้างบัญชีพนักงานใหม่: "${created.name}" (${created.department})`);
  };

  // currentUser re-syncs on its own once `employees` updates below — see the session-restore
  // effect above, which re-derives currentUser from the employees array on every change. Shared
  // by both the self-service "แก้ไขโปรไฟล์" form and the admin-only Employee Management edit form.
  const handleUpdateEmployee = async (
    id: string,
    updates: Partial<Pick<Employee, 'name' | 'nickname' | 'role' | 'avatar' | 'department' | 'division' | 'username' | 'accountType' | 'restrictedMenuIds' | 'phone' | 'address' | 'email' | 'mutedNotificationCategories'>> & { password?: string }
  ) => {
    await updateEmployeeRemote(id, updates, currentUser?.id);
    // password is a login-only field, never part of the Employee shape kept in state/localStorage
    const { password: _password, ...employeeFields } = updates;
    const updated = employees.map(emp => (emp.id === id ? { ...emp, ...employeeFields } : emp));
    setEmployees(updated);
    const target = updated.find(emp => emp.id === id);
    if (target) handleLogAudit('UPDATE_EMPLOYEE', `แก้ไขข้อมูลพนักงาน: "${target.name}"`);
  };

  const handleDeleteEmployee = async (id: string, reason: string) => {
    const target = employees.find(emp => emp.id === id);
    await deleteEmployeeRemote(id, currentUser?.id);
    const updated = employees.filter(emp => emp.id !== id);
    setEmployees(updated);
    if (target) handleLogAudit('DELETE_EMPLOYEE', `ลบบัญชีพนักงาน: "${target.name}" ออกจากระบบถาวร — เหตุผล: ${reason}`);
  };

  // Settings → เปลี่ยนรหัสผ่าน — a dedicated call (not handleUpdateEmployee) since it carries its own
  // once-a-day limit; the password itself never enters client state, only an audit line.
  const handleChangeSelfPassword = async (password: string) => {
    if (!currentUser) return;
    await changeSelfPassword(currentUser.id, password);
    handleLogAudit('CHANGE_PASSWORD', `เปลี่ยนรหัสผ่านของตัวเอง: "${currentUser.name}"`);
  };

  // A name/nickname change request is decided on an admin's own client, so the requester's copy of
  // `employees`/`changeRequests` is stale until reloaded — the Settings page calls this on open so
  // it never shows an already-approved request as still pending (or an old name).
  const handleRefreshAccountData = async () => {
    const [freshEmployees, freshRequests] = await Promise.all([fetchEmployees(), fetchChangeRequests()]);
    setEmployees(freshEmployees);
    setChangeRequests(freshRequests);
  };

  // 0a. Project Operations (จัดการงานและโครงการ) — real `project` table, no localStorage layer.
  // Create awaits the API since the server generates both `id` and the human-facing "PRJ-NNN"
  // code, unlike credentials' fire-and-forget pattern where the client already owns the id.
  const handleAddProject = async (payload: CreateProjectPayload) => {
    const created = await createProject(payload);
    setProjects((prev) => [created, ...prev]);
    handleLogAudit('ADD_PROJECT', `สร้างโครงการใหม่: "${created.title}" (${created.code})`);

    // Same "tell the assignee" principle task assignment already follows (see handleAddProjectTask)
    // — being made ผู้รับผิดชอบหลัก of a project is exactly as notification-worthy as being assigned
    // a task in it, but had no notification at all until now.
    created.ownerEmployeeIds
      .filter((employeeId) => employeeId !== currentUser?.id)
      .forEach((employeeId) => {
        pushNotification({
          targetEmployeeId: employeeId,
          title: 'คุณถูกตั้งเป็นผู้รับผิดชอบหลัก',
          category: 'assignment',
          message: `คุณถูกตั้งเป็นผู้รับผิดชอบหลักโครงการ "${created.title}"`,
          type: 'info',
          linkType: 'project',
          linkId: created.id,
        });
      });

    return created;
  };

  // Awaited (not optimistic) — replaces the local row with the server's freshly re-formatted
  // version rather than merging raw `updates` straight into state, since an edit may submit raw
  // ISO dates while ProjectRow.startDate/endDate must stay Thai-formatted display text.
  const handleUpdateProject = async (id: string, updates: Partial<ProjectRow>) => {
    const before = projects.find((p) => p.id === id);
    const updated = await updateProjectRemote(id, updates, currentUser?.id ?? '');
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    handleLogAudit('UPDATE_PROJECT', `แก้ไขโครงการ: "${updated.title}" (${updated.code})`);

    // Only notify owners that are newly added by this update — re-saving an already-owned project
    // (or any other field edit) must not re-notify people who were owners before.
    if (updates.ownerEmployeeIds) {
      const previousOwnerIds = new Set(before?.ownerEmployeeIds ?? []);
      updated.ownerEmployeeIds
        .filter((employeeId) => !previousOwnerIds.has(employeeId) && employeeId !== currentUser?.id)
        .forEach((employeeId) => {
          pushNotification({
            targetEmployeeId: employeeId,
            title: 'คุณถูกตั้งเป็นผู้รับผิดชอบหลัก',
            category: 'assignment',
            message: `คุณถูกตั้งเป็นผู้รับผิดชอบหลักโครงการ "${updated.title}"`,
            type: 'info',
            linkType: 'project',
            linkId: updated.id,
          });
        });
    }
  };

  const handleDeleteProject = async (id: string) => {
    const target = projects.find((p) => p.id === id);
    await deleteProjectRemote(id, currentUser?.id ?? '');
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // The server already cascades this at the DB level (project_task.project_id ON DELETE
    // CASCADE) — without this, the client's own in-memory projectTasks kept the now-deleted
    // project's tasks around, showing up as ghost rows tagged "ไม่ทราบโครงการ" (e.g. in
    // MyWorkspace) until the next full reload silently dropped them.
    setProjectTasks((prev) => prev.filter((t) => t.projectId !== id));
    // The server also removes the project's Drive files/folders, and moves any vault secret filed
    // under it back to its creator's personal vault — mirror both so nothing lingers on screen.
    setDocuments((prev) => prev.filter((d) => d.projectId !== id));
    setCredentials((prev) => prev.map((c) => (c.scope === 'โครงการ' && c.projectId === id ? { ...c, scope: 'ส่วนตัว', projectId: undefined, team: undefined } : c)));
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

  // Custom project types ("อื่นๆ ระบุ..." in CreateProjectModal's type dropdown) — same immediate
  // re-registration as custom project statuses above, into statusMeta.ts's PROJECT_TYPE_META.
  const handleAddCustomProjectType = async (label: string, abbreviation: string) => {
    const created = await createProjectCustomType(label, abbreviation, currentUser?.id);
    setCustomProjectTypes((prev) => {
      const next = [...prev, created];
      registerCustomTypeLabels(next);
      return next;
    });
    return created;
  };

  const handleAddProjectTask = async (task: Omit<ProjectTaskItem, 'id'>) => {
    const created = await createProjectTask(task);
    setProjectTasks((prev) => {
      const next = [created, ...prev];
      return created.parentTaskId ? recomputeAncestorTaskStatuses(next, created.parentTaskId) : next;
    });

    // Mirrors the server's own auto-promotion (see POST /api/project-tasks) — a 'draft' project
    // isn't a draft anymore once it has a real task, so reflect that locally right away instead
    // of waiting for a full reload to notice the server already flipped it.
    setProjects((prev) => prev.map((p) => (p.id === created.projectId && p.status === 'draft' ? { ...p, status: 'in_progress' } : p)));

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
          category: 'assignment',
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
    const updated = await updateProjectTaskRemote(id, updates, currentUser?.id ?? '');
    setProjectTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? updated : t));
      return updated.parentTaskId ? recomputeAncestorTaskStatuses(next, updated.parentTaskId) : next;
    });

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
        category: 'review',
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
        category: 'review',
        message: passed
          ? `งาน "${updated.title}" ในโครงการ ${projectTitle} ผ่านการตรวจเรียบร้อย`
          : `งาน "${updated.title}" ถูกตีกลับ: ${updates.reviewNote || 'ไม่ได้ระบุเหตุผล'}`,
        type: passed ? 'success' : 'warning',
        linkType: 'project',
        linkId: updated.projectId,
      });
    }

    // Marked ติดปัญหา (blocked) via AddTaskModal's checkbox — everyone already involved in the
    // project (owners, members, the task's own assignees/reviewers) should see it, not just
    // whoever happens to be watching the task table.
    if (updates.status === 'blocked' && before?.status !== 'blocked') {
      const project = projects.find((p) => p.id === updated.projectId);
      const involvedIds = new Set([
        ...(project?.ownerEmployeeIds ?? []),
        ...(project?.memberEmployeeIds ?? []),
        ...(updated.assigneeEmployeeIds ?? []),
        ...(updated.reviewerEmployeeIds ?? []),
      ]);
      notifyEach(Array.from(involvedIds), {
        title: 'งานติดปัญหา',
        category: 'blocked',
        message: `งาน "${updated.title}" ในโครงการ ${projectTitle} ถูกทำเครื่องหมายว่าติดปัญหา: ${updated.blockedReason || 'ไม่ได้ระบุเหตุผล'}`,
        type: 'warning',
        linkType: 'project',
        linkId: updated.projectId,
      });
    }
  };

  const handleDeleteProjectTask = async (id: string) => {
    const before = projectTasks.find((t) => t.id === id);
    await deleteProjectTaskRemote(id, currentUser?.id ?? '');
    // Deleting a task with subtasks cascades server-side (ON DELETE CASCADE) — drop them from
    // local state too, or they'd keep showing (pointing at a now-nonexistent parent) until the
    // next full reload.
    setProjectTasks((prev) => {
      const next = prev.filter((t) => t.id !== id && t.parentTaskId !== id);
      return before?.parentTaskId ? recomputeAncestorTaskStatuses(next, before.parentTaskId) : next;
    });
  };

  // Filed whenever the current user isn't one of an entity's owners (project.ownerEmployeeIds, or
  // a task's own assigneeEmployeeIds) but wants to edit/delete it anyway — the entity itself is
  // left untouched here; only handleDecideChangeRequest's approve path actually changes it. Every
  // current owner gets notified, since any one of them can decide (equal authority).
  const handleRequestChange = async (
    entityType: 'project' | 'project_task' | 'employee',
    entityId: string,
    requestType: 'edit' | 'delete',
    proposedChanges: Record<string, unknown> | undefined,
    reason: string
  ) => {
    const request = await createChangeRequest({
      entityType, entityId, requestType, proposedChanges, reason,
      requestedBy: currentUser?.id ?? '',
    });
    setChangeRequests((prev) => [request, ...prev]);

    // A name/nickname change request (Settings) has no owner to tell — every admin-like account
    // can decide it, so all of them are notified instead.
    if (entityType === 'employee') {
      const who = currentUser?.nickname || currentUser?.name || 'พนักงาน';
      employees
        .filter((emp) => emp.id !== currentUser?.id && (emp.accountType === 'admin' || emp.accountType === 'superadmin' || emp.accountType === 'executive'))
        .forEach((emp) => pushNotification({
          targetEmployeeId: emp.id,
          title: 'มีคำขอเปลี่ยนชื่อรออนุมัติ',
          category: 'approval',
          message: `${who} ขอเปลี่ยนชื่อ/ชื่อเล่น — เหตุผล: ${reason}`,
          type: 'warning',
        }));
      handleLogAudit('REQUEST_EDIT', `ขอเปลี่ยนชื่อ/ชื่อเล่นของตัวเอง — เหตุผล: ${reason}`);
      return;
    }

    const project = entityType === 'project' ? projects.find((p) => p.id === entityId) : undefined;
    const task = entityType === 'project_task' ? projectTasks.find((t) => t.id === entityId) : undefined;
    const ownerIds = project?.ownerEmployeeIds ?? task?.assigneeEmployeeIds ?? [];
    const entityTitle = project?.title ?? task?.title ?? (entityType === 'project' ? 'โครงการ' : 'งาน');
    const linkProjectId = project?.id ?? task?.projectId;
    const requesterName = currentUser?.nickname || currentUser?.name || 'พนักงาน';

    ownerIds
      .filter((empId) => empId !== currentUser?.id)
      .forEach((empId) => pushNotification({
        targetEmployeeId: empId,
        title: requestType === 'edit' ? 'มีคำขอแก้ไขรออนุมัติ' : 'มีคำขอลบรออนุมัติ',
        category: 'approval',
        message: `${requesterName} ขอ${requestType === 'edit' ? 'แก้ไข' : 'ลบ'} "${entityTitle}" — เหตุผล: ${reason}`,
        type: 'warning',
        linkType: 'project',
        linkId: linkProjectId,
      }));

    handleLogAudit(
      requestType === 'edit' ? 'REQUEST_EDIT' : 'REQUEST_DELETE',
      `ขอ${requestType === 'edit' ? 'แก้ไข' : 'ลบ'}${entityType === 'project' ? 'โครงการ' : 'งาน'}: "${entityTitle}" — เหตุผล: ${reason}`
    );
  };

  // Approve applies the change server-side (see change-requests.ts's decide handler) before this
  // even runs — the refetch here just brings the already-updated/already-deleted row(s) back into
  // local state, same "small dataset, just reload it" approach the initial page load already uses,
  // since there's no single-entity GET endpoint to patch just the one row that changed.
  const handleDecideChangeRequest = async (requestId: string, decision: 'approve' | 'reject', note?: string) => {
    const before = changeRequests.find((r) => r.id === requestId);
    const updated = await decideChangeRequest(requestId, decision, currentUser?.id ?? '', note);
    setChangeRequests((prev) => prev.map((r) => (r.id === requestId ? updated : r)));
    if (!before) return;

    // Employee-entity request (name/nickname change): approval already updated the employee row
    // server-side, so just reload the employee list; the only person to tell is the requester.
    if (before.entityType === 'employee') {
      if (decision === 'approve') {
        const freshEmployees = await fetchEmployees();
        setEmployees(freshEmployees);
      }
      if (before.requestedBy) {
        pushNotification({
          targetEmployeeId: before.requestedBy,
          title: decision === 'approve' ? 'คำขอของคุณได้รับการอนุมัติแล้ว' : 'คำขอของคุณไม่ได้รับการอนุมัติ',
          category: 'approval',
          message: decision === 'approve'
            ? 'คำขอเปลี่ยนชื่อ/ชื่อเล่นของคุณได้รับการอนุมัติแล้ว'
            : `คำขอเปลี่ยนชื่อ/ชื่อเล่นของคุณถูกปฏิเสธ${note ? `: ${note}` : ''}`,
          type: decision === 'approve' ? 'success' : 'warning',
        });
      }
      handleLogAudit(
        decision === 'approve' ? 'APPROVE_CHANGE_REQUEST' : 'REJECT_CHANGE_REQUEST',
        `${decision === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอเปลี่ยนชื่อ/ชื่อเล่น${note ? ` — เหตุผล: ${note}` : ''}`
      );
      return;
    }

    const project = before.entityType === 'project' ? projects.find((p) => p.id === before.entityId) : undefined;
    const task = before.entityType === 'project_task' ? projectTasks.find((t) => t.id === before.entityId) : undefined;
    const entityTitle = project?.title ?? task?.title ?? (before.entityType === 'project' ? 'โครงการ' : 'งาน');
    const linkProjectId = project?.id ?? task?.projectId;

    if (decision === 'approve') {
      const [freshProjects, freshTasks] = await Promise.all([fetchProjects(), fetchProjectTasks()]);
      setProjects(freshProjects);
      setProjectTasks(freshTasks);
      // An approved project deletion also removes its Drive files and re-files its vault secrets.
      if (before.entityType === 'project' && before.requestType === 'delete' && currentUser) {
        const [freshDocs, freshCredentials] = await Promise.all([fetchDocuments(currentUser.id), fetchCredentials(currentUser.id)]);
        setDocuments(freshDocs);
        setCredentials(freshCredentials);
      }

      // Re-look-up post-edit (not the stale pre-approval `project`/`task` above) so anyone newly
      // added by this very change — e.g. a change-request that added a ผู้รับผิดชอบหลัก — is
      // actually included below, instead of only whoever was already involved before the edit.
      const freshProject = before.entityType === 'project' ? freshProjects.find((p) => p.id === before.entityId) : undefined;
      const freshTask = before.entityType === 'project_task' ? freshTasks.find((t) => t.id === before.entityId) : undefined;

      // A newly added ผู้รับผิดชอบหลัก gets the same dedicated notification the direct-save path
      // (handleUpdateProject) sends — the generic "มีการแก้ไข" below has no context for a first-time
      // owner to make sense of.
      const previousOwnerIds = new Set(project?.ownerEmployeeIds ?? []);
      const newlyAddedOwnerIds = (freshProject?.ownerEmployeeIds ?? []).filter(
        (empId) => !previousOwnerIds.has(empId) && empId !== currentUser?.id
      );
      newlyAddedOwnerIds.forEach((empId) => pushNotification({
        targetEmployeeId: empId,
        title: 'คุณถูกตั้งเป็นผู้รับผิดชอบหลัก',
        category: 'assignment',
        message: `คุณถูกตั้งเป็นผู้รับผิดชอบหลักโครงการ "${entityTitle}"`,
        type: 'info',
        linkType: 'project',
        linkId: linkProjectId,
      }));

      const others = new Set([...(freshProject?.ownerEmployeeIds ?? []), ...(freshProject?.memberEmployeeIds ?? []), ...(freshTask?.assigneeEmployeeIds ?? []), ...(freshTask?.reviewerEmployeeIds ?? [])]);
      others.delete(currentUser?.id ?? '');
      newlyAddedOwnerIds.forEach((empId) => others.delete(empId));
      if (before.requestedBy) {
        pushNotification({
          targetEmployeeId: before.requestedBy,
          title: 'คำขอของคุณได้รับการอนุมัติแล้ว',
          category: 'approval',
          message: `คำขอ${before.requestType === 'edit' ? 'แก้ไข' : 'ลบ'} "${entityTitle}" ได้รับการอนุมัติแล้ว`,
          type: 'success',
          linkType: 'project',
          linkId: linkProjectId,
        });
        others.delete(before.requestedBy);
      }
      others.forEach((empId) => pushNotification({
        targetEmployeeId: empId,
        title: before.requestType === 'edit' ? 'มีการแก้ไข' : 'มีการลบ',
        category: 'approval',
        message: `"${entityTitle}" ถูก${before.requestType === 'edit' ? 'แก้ไข' : 'ลบ'}แล้ว`,
        type: 'info',
        linkType: 'project',
        linkId: linkProjectId,
      }));
    } else if (before.requestedBy) {
      pushNotification({
        targetEmployeeId: before.requestedBy,
        title: 'คำขอของคุณไม่ได้รับการอนุมัติ',
        category: 'approval',
        message: `คำขอ${before.requestType === 'edit' ? 'แก้ไข' : 'ลบ'} "${entityTitle}" ถูกปฏิเสธ${note ? `: ${note}` : ''}`,
        type: 'warning',
        linkType: 'project',
        linkId: linkProjectId,
      });
    }

    handleLogAudit(
      decision === 'approve' ? 'APPROVE_CHANGE_REQUEST' : 'REJECT_CHANGE_REQUEST',
      `${decision === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอ${before.requestType === 'edit' ? 'แก้ไข' : 'ลบ'}: "${entityTitle}"${note ? ` — เหตุผล: ${note}` : ''}`
    );
  };

  // 0b. Org Chart Structure Operations (โครงสร้างองค์กร) — now a real, shared table
  // (server/routes/org-structure.ts) instead of localStorage, editable from Employee Management's
  // โครงสร้างองค์กร tab. Renaming a division or section cascades to every employee currently
  // pointing at the old name so no one silently falls out of the chart; deleting one does not —
  // affected employees just show up as "ยังไม่ระบุฝ่าย" until reassigned.
  //
  // OrgChart.tsx's modals call these synchronously and don't await or catch anything, same as
  // before this migration — orgDivisions only actually updates once the server confirms the
  // change (each API call resolves with the full, freshly-reloaded list), so a rejected request
  // (e.g. a duplicate name from a race with another admin, or a permission check failing) just
  // leaves the chart as it was instead of drifting from what the server actually has.
  const handleAddDivision = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || orgDivisions.some((d) => d.name === trimmed) || !currentUser) return;
    addOrgDivision(trimmed, currentUser.id)
      .then((updated) => {
        setOrgDivisions(updated);
        handleLogAudit('ADD_ORG_DIVISION', `เพิ่มฝ่ายใหม่: "${trimmed}"`);
      })
      .catch((err) => reportActionFailure(err, 'เพิ่มฝ่ายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
  };

  const handleRenameDivision = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || orgDivisions.some((d) => d.name === trimmed) || !currentUser) return;
    renameOrgDivision(oldName, trimmed, currentUser.id)
      .then(async (updated) => {
        setOrgDivisions(updated);
        // The server already moved every employee onto the new name — just pull the fresh list.
        setEmployees(await fetchEmployees());
        handleLogAudit('RENAME_ORG_DIVISION', `เปลี่ยนชื่อฝ่าย: "${oldName}" → "${trimmed}"`);
      })
      .catch((err) => reportActionFailure(err, 'เปลี่ยนชื่อฝ่ายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
  };

  const handleDeleteDivision = (name: string) => {
    if (!currentUser) return;
    deleteOrgDivision(name, currentUser.id)
      .then((updated) => {
        setOrgDivisions(updated);
        handleLogAudit('DELETE_ORG_DIVISION', `ลบฝ่าย: "${name}"`);
      })
      .catch((err) => reportActionFailure(err, 'ลบฝ่ายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
  };

  const handleAddSection = (divisionName: string, sectionName: string) => {
    const trimmed = sectionName.trim();
    if (!trimmed || !currentUser) return;
    addOrgSection(divisionName, trimmed, currentUser.id)
      .then((updated) => {
        setOrgDivisions(updated);
        handleLogAudit('ADD_ORG_SECTION', `เพิ่มแผนกใหม่: "${trimmed}" ในฝ่าย "${divisionName}"`);
      })
      .catch((err) => reportActionFailure(err, 'เพิ่มแผนกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
  };

  const handleRenameSection = (divisionName: string, oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || !currentUser) return;
    renameOrgSection(divisionName, oldName, trimmed, currentUser.id)
      .then(async (updated) => {
        setOrgDivisions(updated);
        // The server renamed the แผนก on everything that stores its name (employees, projects,
        // meetings, team vault entries) in one transaction — reload what it touched.
        const [freshEmployees, freshProjects, freshMeetings, freshCredentials] = await Promise.all([
          fetchEmployees(),
          fetchProjects(),
          fetchMeetings(),
          fetchCredentials(currentUser.id),
        ]);
        setEmployees(freshEmployees);
        setProjects(freshProjects);
        setMeetings(freshMeetings);
        setCredentials(freshCredentials);
        handleLogAudit('RENAME_ORG_SECTION', `เปลี่ยนชื่อแผนก: "${oldName}" → "${trimmed}"`);
      })
      .catch((err) => reportActionFailure(err, 'เปลี่ยนชื่อแผนกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
  };

  const handleDeleteSection = (divisionName: string, sectionName: string) => {
    if (!currentUser) return;
    deleteOrgSection(divisionName, sectionName, currentUser.id)
      .then((updated) => {
        setOrgDivisions(updated);
        handleLogAudit('DELETE_ORG_SECTION', `ลบแผนก: "${sectionName}" ออกจากฝ่าย "${divisionName}"`);
      })
      .catch((err) => reportActionFailure(err, 'ลบแผนกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
  };

  // 3. Document Operations — documents live in the real `document` table now (see
  // server/routes/documents.ts); visibility itself (not just these mutations) is server-enforced,
  // see the `fetchDocuments` effect above.
  //
  // Returns the created row (not void) — callers that need the server-assigned id right away
  // (e.g. SubmitTaskModal linking a just-attached file into `submissionFileIds`) await this call;
  // callers that don't (DocVault's own create forms) can just fire-and-forget it.
  const handleAddDocument = async (newDoc: Omit<LinkedDoc, 'id'>): Promise<LinkedDoc> => {
    const created = await createDocument({ ...newDoc, creatorEmployeeId: newDoc.creatorEmployeeId ?? currentUser?.id });
    setDocuments((prev) => [created, ...prev]);
    const actionLabel = created.kind === 'folder' ? 'สร้างโฟลเดอร์' : created.kind === 'file' ? 'อัปโหลดไฟล์' : 'แนบลิงก์เอกสาร';
    handleLogAudit('ADD_DOCUMENT', `${actionLabel}ใน Drive: "${created.name}"`);
    return created;
  };

  const handleEditDocument = async (docId: string, updates: { name: string; url?: string; scope: LinkedDoc['scope']; projectId?: string }) => {
    const doc = documents.find(d => d.id === docId);
    const updated = await updateDocumentRemote(docId, { ...updates, projectId: updates.scope === 'โครงการ' ? updates.projectId : undefined });
    setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
    if (doc) handleLogAudit('EDIT_DOCUMENT', `แก้ไข${doc.kind === 'folder' ? 'โฟลเดอร์' : doc.kind === 'file' ? 'ไฟล์' : 'ลิงก์'}: "${doc.name}"${updates.name !== doc.name ? ` → "${updates.name}"` : ''}`);
  };

  // Drag-and-drop move: reparents a document into a different folder. Guards against dropping a
  // folder into itself or into one of its own descendants, which would create a cycle — checked
  // against the locally-loaded `documents` tree, same as before; the server itself doesn't need
  // its own cycle guard since it just writes whatever parent_id it's given.
  const handleMoveDocument = async (docId: string, newParentId: string) => {
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
    const updated = await updateDocumentRemote(docId, { parentId: newParentId });
    setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
    if (targetFolder) {
      const label = doc.kind === 'folder' ? 'โฟลเดอร์' : doc.kind === 'file' ? 'ไฟล์' : 'ลิงก์';
      handleLogAudit('MOVE_DOCUMENT', `ย้าย${label} "${doc.name}" ไปยังโฟลเดอร์ "${targetFolder.name}"`);
    }
  };

  // Deleting a folder cascades to everything nested inside it server-side (parent_id's own
  // ON DELETE CASCADE) — the breadth-first walk here is now only for an instant local UI update,
  // not because anything would otherwise be orphaned.
  const handleDeleteDocument = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    await deleteDocumentRemote(docId);
    const idsToDelete = new Set<string>([docId]);
    let frontier = [docId];
    while (frontier.length > 0) {
      const children = documents.filter(d => d.parentId && frontier.includes(d.parentId)).map(d => d.id);
      children.forEach(id => idsToDelete.add(id));
      frontier = children;
    }
    setDocuments((prev) => prev.filter(d => !idsToDelete.has(d.id)));
    if (doc) {
      const label = doc.kind === 'folder' ? `โฟลเดอร์ "${doc.name}" และเนื้อหาข้างในทั้งหมด` : `เอกสาร "${doc.name}"`;
      handleLogAudit('DELETE_DOCUMENT', `ลบ${label}ออกจาก Drive ถาวร`);
    }
  };

  const handleAddMeeting = async (newMeeting: Omit<Meeting, 'id'>) => {
    const created = await createMeeting(newMeeting);
    setMeetings((prev) => [created, ...prev]);
    handleLogAudit('CREATE_MEETING', `นัดประชุม "${created.title}" วันที่ ${formatThaiDateShort(created.date)} เวลา ${created.startTime}`);

    created.attendeeIds
      .filter((attendeeId) => attendeeId !== currentUser?.id)
      .forEach((attendeeId) => {
        pushNotification({
          targetEmployeeId: attendeeId,
          title: 'มีนัดประชุมใหม่',
          category: 'meeting',
          message: `"${created.title}" วันที่ ${formatThaiDateShort(created.date)} เวลา ${created.startTime}`,
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
            category: 'meeting',
            message: `"${updated.title}" วันที่ ${formatThaiDateShort(updated.date)} ถูกยกเลิก: ${updated.cancellationReason || 'ไม่ได้ระบุเหตุผล'}`,
            type: 'warning',
            linkType: updated.projectId ? 'project' : undefined,
            linkId: updated.projectId,
          });
        });
    }
  };

  // 5. Credential Safe Operations — visibility itself (not just these mutations) is
  // server-enforced now, see the fetchCredentials effect above. creatorEmployeeId is stamped here
  // (not trusted from the form) so a personal-scope item is always attributable to a real id.
  const handleAddCredential = async (newItem: CredentialItem) => {
    const withCreator = { ...newItem, creatorEmployeeId: currentUser?.id };
    setCredentials((prev) => [withCreator, ...prev]);
    await createCredential(withCreator);
  };

  const handleUpdateCredential = async (id: string, updates: Partial<CredentialItem>) => {
    const updated = credentials.map(c => (c.id === id ? { ...c, ...updates } : c));
    setCredentials(updated);
    const updatedItem = updated.find(c => c.id === id);
    if (updatedItem) {
      await updateCredentialRemote(id, updatedItem);
    }
  };

  const handleDeleteCredential = async (id: string) => {
    setCredentials((prev) => prev.filter(c => c.id !== id));
    await deleteCredentialRemote(id);
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

  // A project's own `progress` column is never actually written by any real flow (no create/edit
  // form sends it) — it only ever gets a real value from test fixtures poked in directly via the
  // API. Every consumer (ProjectCard's ring, ProjectTable's bar, MyWorkspace's "โครงการของฉัน"
  // table, ProjectDetail's overview card) is meant to show live task-completion instead, so it's
  // computed once here and overridden on every ProjectRow exposed downstream — a single source of
  // truth, rather than each screen recomputing (or forgetting to recompute) its own done/total.
  const projectsWithComputedProgress = useMemo(
    () => projects.map((p) => {
      const tasksInProject = projectTasks.filter((t) => t.projectId === p.id);
      if (tasksInProject.length === 0) return p;
      const doneCount = tasksInProject.filter((t) => t.status === 'done').length;
      return { ...p, progress: Math.round((doneCount / tasksInProject.length) * 100) };
    }),
    [projects, projectTasks]
  );

  const value: AppDataContextValue = {
    currentUser,
    isRestoringSession,
    handleLogin,
    handleLogout,
    employees,
    projects: projectsWithComputedProgress,
    projectTasks,
    documents,
    credentials,
    meetings,
    notifications,
    auditLogs,
    unreadCount,
    handleAddEmployee,
    handleUpdateEmployee,
    handleChangeSelfPassword,
    handleRefreshAccountData,
    handleDeleteEmployee,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    customProjectStatuses,
    handleAddCustomProjectStatus,
    handleDeleteCustomProjectStatus,
    customProjectTypes,
    handleAddCustomProjectType,
    handleAddProjectTask,
    handleUpdateProjectTask,
    handleDeleteProjectTask,
    changeRequests,
    handleRequestChange,
    handleDecideChangeRequest,
    handleAddDocument,
    handleEditDocument,
    handleDeleteDocument,
    handleMoveDocument,
    docCurrentFolderId,
    setDocCurrentFolderId,
    taskSelectedProjectId,
    setTaskSelectedProjectId,
    taskSelectedTab,
    setTaskSelectedTab,
    handleAddMeeting,
    handleUpdateMeeting,
    handleAddCredential,
    handleUpdateCredential,
    handleDeleteCredential,
    handleLogAudit,
    handleMarkAllNotificationsRead,
    handleMarkNotificationRead,
    notificationToast,
    dismissNotificationToast,
    appError,
    dismissAppError,
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
