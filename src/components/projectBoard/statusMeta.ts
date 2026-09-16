import { Ban, CheckCircle2, Clock, ClipboardCheck, FileText, Lightbulb, PauseCircle, Tag } from 'lucide-react';
import { CustomProjectStatus, ProjectPriority, ProjectStatus, ProjectTaskStatus, ProjectType } from './types';

export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ['draft', 'pending_review', 'in_progress', 'on_hold', 'completed', 'cancelled', 'idea'];

// Reworked after /impeccable critique: the original Figma-exported hex values put
// in_progress and cancelled a few RGB steps apart — nearly indistinguishable in a quick scan —
// and on_hold's pill text (#B6AD10 on #FFF9BC) failed WCAG AA contrast. These values push the
// hues clearly apart (blue/green/amber/red/slate/violet/teal) and keep every pill's text/bg pair
// at 4.5:1+ contrast, while still reading as "in motion, success green, caution amber, danger
// red, neutral slate" at a glance.
const BASE_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: 'ร่าง',
  pending_review: 'รอตรวจสอบ',
  in_progress: 'กำลังดำเนินการ',
  on_hold: 'พัก',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
  idea: 'ไอเดีย',
};

// User-specified brand colors — used identically everywhere a status shows color: the small
// dot, the summary-card watermark icon, and (per explicit request) the pill/tag text too. Kept
// as one lookup so all three can never drift apart. Note this trades away some WCAG AA contrast
// on the pill text (e.g. the light cyan on in_progress) in favor of exact brand-color match —
// a deliberate call for small badge text, not body copy.
const BASE_STATUS_DOT: Record<ProjectStatus, string> = {
  draft: '#7B818A',
  pending_review: '#7C3AED',
  in_progress: '#0017C1',
  on_hold: '#FFB03D',
  completed: '#197A4B',
  cancelled: '#FF2A04',
  idea: '#0D9488',
};

// No separate `label` here on purpose — the table pill always shows STATUS_LABEL verbatim so
// it can never drift from the wording shown on the summary cards. `text` intentionally reuses
// STATUS_DOT verbatim (see note above).
const BASE_STATUS_PILL: Record<ProjectStatus, { bg: string; text: string }> = {
  draft: { bg: '#F1F5F9', text: BASE_STATUS_DOT.draft },
  pending_review: { bg: '#EDE9FE', text: BASE_STATUS_DOT.pending_review },
  in_progress: { bg: '#DBEAFE', text: BASE_STATUS_DOT.in_progress },
  on_hold: { bg: '#FEF3C7', text: BASE_STATUS_DOT.on_hold },
  completed: { bg: '#DCFCE7', text: BASE_STATUS_DOT.completed },
  cancelled: { bg: '#FEE2E2', text: BASE_STATUS_DOT.cancelled },
  idea: { bg: '#CCFBF1', text: BASE_STATUS_DOT.idea },
};

// One shared icon per status — used both as the summary card's oversized watermark and as the
// small leading icon inside every status pill/tag, so the two always agree.
const BASE_STATUS_ICON: Record<ProjectStatus, typeof Clock> = {
  draft: FileText,
  pending_review: ClipboardCheck,
  in_progress: Clock,
  on_hold: PauseCircle,
  completed: CheckCircle2,
  cancelled: Ban,
  idea: Lightbulb,
};

// A project's `status` field is a plain string (see types.ts) since it can hold either one of
// the 7 built-ins above or a user-created CustomProjectStatus.id (server/routes/
// project-custom-statuses.ts) — there's no compile-time-closed set of every possible value. The
// Proxies below let every existing STATUS_LABEL[row.status]/STATUS_DOT[row.status]/etc. call site
// across the app keep working completely unchanged for both cases: a known built-in resolves
// from the base maps as before, anything else (a real custom status, or even an orphaned id whose
// definition was later deleted) gets a deterministic hash-derived color/icon so it never renders
// as blank or crashes, plus its registered label when one is known.
const hashPalette = ['#7C3AED', '#0D9488', '#DB2777', '#CA8A04', '#0891B2', '#65A30D', '#DC2626', '#4F46E5'];
function hashStatusId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}
function fallbackColorFor(id: string): string {
  return hashPalette[hashStatusId(id) % hashPalette.length];
}

// Populated once from AppDataContext's customProjectStatuses (fetched alongside projects/
// employees on load, and re-synced immediately whenever a new one is created) — a plain mutable
// map rather than React state here since it's read from inside plain lookup objects that many
// components already index directly (STATUS_LABEL[row.status]), not through a hook.
const customStatusLabels = new Map<string, string>();
export function registerCustomStatusLabels(list: CustomProjectStatus[]): void {
  customStatusLabels.clear();
  list.forEach((s) => customStatusLabels.set(s.id, s.label));
}

function isBuiltIn(status: string): status is ProjectStatus {
  return status in BASE_STATUS_LABEL;
}

export const STATUS_LABEL: Record<string, string> = new Proxy(BASE_STATUS_LABEL, {
  get: (target, prop: string) => (isBuiltIn(prop) ? target[prop] : customStatusLabels.get(prop) ?? prop),
});

export const STATUS_DOT: Record<string, string> = new Proxy(BASE_STATUS_DOT, {
  get: (target, prop: string) => (isBuiltIn(prop) ? target[prop] : fallbackColorFor(prop)),
});

export const STATUS_PILL: Record<string, { bg: string; text: string }> = new Proxy(BASE_STATUS_PILL, {
  get: (target, prop: string) => {
    if (isBuiltIn(prop)) return target[prop];
    const color = fallbackColorFor(prop);
    return { bg: `${color}1A`, text: color };
  },
});

export const STATUS_ICON: Record<string, typeof Clock> = new Proxy(BASE_STATUS_ICON, {
  get: (target, prop: string) => (isBuiltIn(prop) ? target[prop] : Tag),
});

// Task-level status (project detail page's "งาน"/"ภาพรวม" tabs) — a separate 5-way scale from
// ProjectStatus above, matching the legend row on the progress overview card (ทั้งหมด/เสร็จแล้ว/
// กำลังทำ/รอตรวจ/ติดปัญหา).

export const TASK_STATUS_LABEL: Record<ProjectTaskStatus, string> = {
  todo: 'ยังไม่เริ่ม',
  in_progress: 'กำลังทำ',
  review: 'รอตรวจ',
  blocked: 'ติดปัญหา',
  done: 'เสร็จแล้ว',
};

export const TASK_STATUS_COLOR: Record<ProjectTaskStatus, string> = {
  todo: '#94A3B8',
  in_progress: '#FF6537',
  review: '#0EA5E9',
  blocked: '#F50C0C',
  done: '#197A4B',
};

// ProjectRow.priority's own scale — the same numeric 1-5 scale as task priority
// (CreateProjectModal.tsx's PRIORITY_OPTIONS), shown wherever a project's own priority appears
// (detail meta grid, project table). Same color ramp, simplified to bg+text since this renders
// as a plain pill rather than a bordered button.
export const PROJECT_PRIORITY_META: Record<ProjectPriority, { label: string; className: string }> = {
  1: { label: '1 (สูงสุด)', className: 'bg-red-50 text-red-600' },
  2: { label: '2', className: 'bg-orange-50 text-orange-600' },
  3: { label: '3', className: 'bg-[#FFF1EC] text-[#FF6537]' },
  4: { label: '4', className: 'bg-blue-50 text-blue-600' },
  5: { label: '5 (ต่ำสุด)', className: 'bg-slate-100 text-slate-600' },
};

// "ประเภทโครงการ" — label shown wherever a project's type appears, and the abbreviation used to
// build the project code ({abbreviation}-{2-digit BE year}-{type}-{sequence}).
export const PROJECT_TYPE_META: Record<ProjectType, { label: string }> = {
  P: { label: 'โครงการ' },
  SP: { label: 'โครงการย่อย' },
  I: { label: 'นวัตกรรม' },
  C: { label: 'ที่ปรึกษา' },
  B: { label: 'ออกบูธ' },
  FND: { label: 'ทุน' },
};

export const PROJECT_TYPE_OPTIONS: ProjectType[] = ['P', 'SP', 'I', 'C', 'B', 'FND'];
