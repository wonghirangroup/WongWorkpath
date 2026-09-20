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
  INITIAL_EMPLOYEES
} from '../data/mockData';
import { fetchEmployees, createEmployee, updateEmployeeRemote, deleteEmployeeRemote, fetchCredentials, createCredential, updateCredentialRemote, deleteCredentialRemote, fetchProjects, createProject, updateProjectRemote, deleteProjectRemote, CreateProjectPayload, fetchMeetings, createMeeting, updateMeetingRemote, fetchProjectTasks, createProjectTask, updateProjectTaskRemote, deleteProjectTaskRemote, fetchProjectCustomStatuses, createProjectCustomStatus, deleteProjectCustomStatusRemote, fetchNotifications, createNotification, markNotificationRead, markAllNotificationsRead, CreateNotificationPayload, fetchChangeRequests, createChangeRequest, decideChangeRequest, ChangeRequest, fetchDocuments, createDocument, updateDocumentRemote, deleteDocumentRemote } from '../lib/api';
import { nowTimestamp } from '../lib/datetime';
import type { ProjectRow, ProjectTaskItem, CustomProjectStatus } from '../components/projectBoard/types';
import { registerCustomStatusLabels } from '../components/projectBoard/statusMeta';

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

  // Mutations
  handleAddEmployee: (employee: Employee & { password: string }) => Promise<void>;
  handleUpdateEmployee: (
    id: string,
    updates: Partial<Pick<Employee, 'name' | 'nickname' | 'role' | 'avatar' | 'department' | 'division' | 'username' | 'accountType' | 'restrictedMenuIds' | 'phone' | 'address'>> & { password?: string }
  ) => Promise<void>;
  handleDeleteEmployee: (id: string, reason: string) => Promise<void>;
  handleAddProject: (payload: CreateProjectPayload) => Promise<ProjectRow>;
  handleUpdateProject: (id: string, updates: Partial<ProjectRow>) => Promise<void>;
  handleDeleteProject: (id: string) => Promise<void>;
  customProjectStatuses: CustomProjectStatus[];
  handleAddCustomProjectStatus: (label: string) => Promise<CustomProjectStatus>;
  handleDeleteCustomProjectStatus: (id: string) => Promise<void>;
  handleAddProjectTask: (task: Omit<ProjectTaskItem, 'id'>) => Promise<ProjectTaskItem>;
  handleUpdateProjectTask: (id: string, updates: Partial<ProjectTaskItem>) => Promise<void>;
  handleDeleteProjectTask: (id: string) => Promise<void>;
  changeRequests: ChangeRequest[];
  handleRequestChange: (
    entityType: 'project' | 'project_task',
    entityId: string,
    requestType: 'edit' | 'delete',
    proposedChanges: Record<string, unknown> | undefined,
    reason: string
  ) => Promise<void>;
  handleDecideChangeRequest: (requestId: string, decision: 'approve' | 'reject', note?: string) => Promise<void>;
  handleDeleteTask: (id: string) => void;
  handleInitiateHandover: (taskId: string, fromUserId: string, toUserId: string, stageName: string, notes: string) => void;
  handleApproveHandover: (taskId: string, handoverId: string, approved: boolean, notes: string) => void;
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
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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

  // Credential Vault items live in the real `credential` table (see server/routes/credentials.ts);
  // visibility is server-enforced there (personal/team/project scoping by real employee id, not
  // the old client-side display-name match) — same actor-scoped shape as the documents fetch below.
  useEffect(() => {
    if (!currentUser) {
      setCredentials([]);
      return;
    }
    let cancelled = false;

    fetchCredentials(currentUser.id)
      .then((apiCredentials) => {
        if (cancelled) return;
        setCredentials(apiCredentials);
      })
      .catch((err) => {
        console.warn('Could not load credentials from the API:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

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

  // Pending/decided edit-or-delete requests (see server/routes/change-requests.ts) — loaded
  // whole, same as projects/tasks, since this is a small internal-tool dataset. Powers both the
  // "is a request already pending here" check before opening an edit/delete form and
  // ProjectDetail's owner-facing pending-requests panel.
  useEffect(() => {
    let cancelled = false;

    fetchChangeRequests()
      .then((requests) => {
        if (cancelled) return;
        setChangeRequests(requests);
      })
      .catch((err) => {
        console.warn('Could not load change requests from the API:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Documents (เอกสาร Drive) live in the real `document` table now — same no-localStorage-layer
  // treatment as projects/tasks/meetings. Unlike those, visibility itself is per-user (a 'ส่วนตัว'
  // doc only shows to its creator; a 'โครงการ' doc only to that project's owners/members), so the
  // server needs to know who's asking — this can't fetch until `currentUser` is known, and must
  // re-fetch whenever it changes (login as someone else must not keep showing the previous
  // person's personal docs).
  useEffect(() => {
    if (!currentUser) {
      setDocuments([]);
      return;
    }
    let cancelled = false;
    fetchDocuments(currentUser.id)
      .then((docs) => {
        if (cancelled) return;
        setDocuments(docs);
      })
      .catch((err) => {
        console.warn('Could not load documents from the API:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // One-time recovery for documents created before today's move to the shared backend — they used
  // to live in this browser's own `unityspace_docs` localStorage, so anyone opening the app here
  // would otherwise see an empty Drive (the data isn't gone, the app just stopped reading it).
  // Runs once per browser: uploads whatever's still sitting in that old key into the real
  // `document` table, then marks itself done so it never re-runs (and never duplicates) here again.
  // Waits for `employees` to actually be loaded (not just currentUser) so it can best-effort match
  // each old doc's original creator by name to a real employee id — matching against an empty list
  // would silently attribute everything to whoever happens to trigger this first.
  useEffect(() => {
    if (!currentUser || employees.length === 0) return;
    if (localStorage.getItem('unityspace_docs_migrated_v1')) return;
    const raw = localStorage.getItem('unityspace_docs');
    // Set the flag before doing any async work — even if the upload below throws partway
    // through, this must never retry (and re-duplicate whatever already made it across).
    localStorage.setItem('unityspace_docs_migrated_v1', 'true');
    if (!raw) return;

    (async () => {
      try {
        const oldDocs: any[] = JSON.parse(raw);
        if (!Array.isArray(oldDocs) || oldDocs.length === 0) return;

        const idMap = new Map<string, string>(); // old localStorage id -> new server id
        const remaining = [...oldDocs];
        let progressed = true;
        while (remaining.length > 0 && progressed) {
          progressed = false;
          for (let i = remaining.length - 1; i >= 0; i--) {
            const d = remaining[i];
            // A folder must be created (and its new id known) before any child referencing it as
            // parentId — skip for now if that hasn't happened yet, retried on the next pass.
            if (d.parentId && !idMap.has(d.parentId) && oldDocs.some((o) => o.id === d.parentId)) continue;

            const creatorName = d.history?.[0]?.updatedBy || d.updatedBy;
            const matchedCreator = employees.find((e) => (e.nickname || e.name) === creatorName);
            const created = await createDocument({
              name: d.name ?? 'ไม่มีชื่อ',
              kind: d.kind === 'folder' || d.kind === 'file' ? d.kind : 'link',
              parentId: d.parentId ? idMap.get(d.parentId) ?? null : null,
              url: d.url,
              fileDataUrl: d.fileDataUrl,
              fileMimeType: d.fileMimeType,
              fileSize: d.fileSize,
              // The old 'ทีม' (department) scope has no equivalent under the current project-based
              // model — falls back to 'ส่วนตัว' rather than guessing a project, same call made when
              // this scope was first retired earlier today.
              scope: 'ส่วนตัว',
              creatorEmployeeId: matchedCreator?.id ?? currentUser.id,
              version: typeof d.version === 'number' ? d.version : 1,
              lastUpdated: d.lastUpdated || nowTimestamp(),
              updatedBy: d.updatedBy || currentUser.name,
              history: Array.isArray(d.history) ? d.history : [],
            });
            idMap.set(d.id, created.id);
            remaining.splice(i, 1);
            progressed = true;
          }
        }

        // Refresh so the recovered documents show up immediately, no manual reload needed.
        const fresh = await fetchDocuments(currentUser.id);
        setDocuments(fresh);
        localStorage.removeItem('unityspace_docs');
      } catch (err) {
        console.warn('Could not migrate old localStorage documents:', err);
      }
    })();
  }, [currentUser, employees]);

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
    await updateEmployeeRemote(id, updates, currentUser?.id);
    // password is a login-only field, never part of the Employee shape kept in state/localStorage
    const { password: _password, ...employeeFields } = updates;
    const updated = employees.map(emp => (emp.id === id ? { ...emp, ...employeeFields } : emp));
    setEmployees(updated);
    localStorage.setItem('unityspace_employees', JSON.stringify(updated));
    const target = updated.find(emp => emp.id === id);
    if (target) handleLogAudit('UPDATE_EMPLOYEE', `แก้ไขข้อมูลพนักงาน: "${target.name}"`);
  };

  const handleDeleteEmployee = async (id: string, reason: string) => {
    const target = employees.find(emp => emp.id === id);
    await deleteEmployeeRemote(id, currentUser?.id);
    const updated = employees.filter(emp => emp.id !== id);
    setEmployees(updated);
    localStorage.setItem('unityspace_employees', JSON.stringify(updated));
    if (target) handleLogAudit('DELETE_EMPLOYEE', `ลบบัญชีพนักงาน: "${target.name}" ออกจากระบบถาวร — เหตุผล: ${reason}`);
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
    const updated = await updateProjectRemote(id, updates, currentUser?.id ?? '');
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    handleLogAudit('UPDATE_PROJECT', `แก้ไขโครงการ: "${updated.title}" (${updated.code})`);
  };

  const handleDeleteProject = async (id: string) => {
    const target = projects.find((p) => p.id === id);
    await deleteProjectRemote(id, currentUser?.id ?? '');
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
        message: `งาน "${updated.title}" ในโครงการ ${projectTitle} ถูกทำเครื่องหมายว่าติดปัญหา: ${updated.blockedReason || 'ไม่ได้ระบุเหตุผล'}`,
        type: 'warning',
        linkType: 'project',
        linkId: updated.projectId,
      });
    }
  };

  const handleDeleteProjectTask = async (id: string) => {
    await deleteProjectTaskRemote(id, currentUser?.id ?? '');
    // Deleting a task with subtasks cascades server-side (ON DELETE CASCADE) — drop them from
    // local state too, or they'd keep showing (pointing at a now-nonexistent parent) until the
    // next full reload.
    setProjectTasks((prev) => prev.filter((t) => t.id !== id && t.parentTaskId !== id));
  };

  // Filed whenever the current user isn't one of an entity's owners (project.ownerEmployeeIds, or
  // a task's own assigneeEmployeeIds) but wants to edit/delete it anyway — the entity itself is
  // left untouched here; only handleDecideChangeRequest's approve path actually changes it. Every
  // current owner gets notified, since any one of them can decide (equal authority).
  const handleRequestChange = async (
    entityType: 'project' | 'project_task',
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

    const project = before.entityType === 'project' ? projects.find((p) => p.id === before.entityId) : undefined;
    const task = before.entityType === 'project_task' ? projectTasks.find((t) => t.id === before.entityId) : undefined;
    const entityTitle = project?.title ?? task?.title ?? (before.entityType === 'project' ? 'โครงการ' : 'งาน');
    const linkProjectId = project?.id ?? task?.projectId;

    if (decision === 'approve') {
      const [freshProjects, freshTasks] = await Promise.all([fetchProjects(), fetchProjectTasks()]);
      setProjects(freshProjects);
      setProjectTasks(freshTasks);

      const others = new Set([...(project?.ownerEmployeeIds ?? []), ...(project?.memberEmployeeIds ?? []), ...(task?.assigneeEmployeeIds ?? []), ...(task?.reviewerEmployeeIds ?? [])]);
      others.delete(currentUser?.id ?? '');
      if (before.requestedBy) {
        pushNotification({
          targetEmployeeId: before.requestedBy,
          title: 'คำขอของคุณได้รับการอนุมัติแล้ว',
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
        message: `"${entityTitle}" ถูก${before.requestType === 'edit' ? 'แก้ไข' : 'ลบ'}แล้ว`,
        type: 'info',
        linkType: 'project',
        linkId: linkProjectId,
      }));
    } else if (before.requestedBy) {
      pushNotification({
        targetEmployeeId: before.requestedBy,
        title: 'คำขอของคุณไม่ได้รับการอนุมัติ',
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
    tasks,
    documents,
    credentials,
    meetings,
    notifications,
    auditLogs,
    unreadCount,
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
    changeRequests,
    handleRequestChange,
    handleDecideChangeRequest,
    handleDeleteTask,
    handleInitiateHandover,
    handleApproveHandover,
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
