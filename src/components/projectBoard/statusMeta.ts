import { Ban, CheckCircle2, Clock, FileText, PauseCircle } from 'lucide-react';
import { ProjectPriority, ProjectStatus, ProjectTaskStatus } from './types';

// Reworked after /impeccable critique: the original Figma-exported hex values put
// in_progress and cancelled a few RGB steps apart — nearly indistinguishable in a quick scan —
// and on_hold's pill text (#B6AD10 on #FFF9BC) failed WCAG AA contrast. These values push the
// 5 hues clearly apart (blue/green/amber/red/slate) and keep every pill's text/bg pair at
// 4.5:1+ contrast, while still reading as "in motion, success green, caution amber, danger red,
// neutral slate" at a glance.
export const STATUS_LABEL: Record<ProjectStatus, string> = {
  in_progress: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  on_hold: 'พัก',
  cancelled: 'ยกเลิก',
  draft: 'ร่าง',
};

// User-specified brand colors — used identically everywhere a status shows color: the small
// dot, the summary-card watermark icon, and (per explicit request) the pill/tag text too. Kept
// as one lookup so all three can never drift apart. Note this trades away some WCAG AA contrast
// on the pill text (e.g. the light cyan on in_progress) in favor of exact brand-color match —
// a deliberate call for small badge text, not body copy.
export const STATUS_DOT: Record<ProjectStatus, string> = {
  in_progress: '#0017C1',
  completed: '#197A4B',
  on_hold: '#FFB03D',
  cancelled: '#FF2A04',
  draft: '#7B818A',
};

// No separate `label` here on purpose — the table pill always shows STATUS_LABEL verbatim so
// it can never drift from the wording shown on the summary cards. `text` intentionally reuses
// STATUS_DOT verbatim (see note above).
export const STATUS_PILL: Record<ProjectStatus, { bg: string; text: string }> = {
  in_progress: { bg: '#DBEAFE', text: STATUS_DOT.in_progress },
  completed: { bg: '#DCFCE7', text: STATUS_DOT.completed },
  on_hold: { bg: '#FEF3C7', text: STATUS_DOT.on_hold },
  cancelled: { bg: '#FEE2E2', text: STATUS_DOT.cancelled },
  draft: { bg: '#F1F5F9', text: STATUS_DOT.draft },
};

// One shared icon per status — used both as the summary card's oversized watermark and as the
// small leading icon inside every status pill/tag, so the two always agree.
export const STATUS_ICON: Record<ProjectStatus, typeof Clock> = {
  in_progress: Clock,
  completed: CheckCircle2,
  on_hold: PauseCircle,
  cancelled: Ban,
  draft: FileText,
};

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

// ProjectRow.priority's own scale (High/Medium/Low) — a different, capitalized scale from
// AddTaskModal/CreateProjectModal's lowercase task-priority options, shown wherever a project's
// own priority appears (detail meta grid, project table).
export const PROJECT_PRIORITY_META: Record<ProjectPriority, { label: string; className: string }> = {
  High: { label: 'สูง', className: 'bg-red-50 text-red-600' },
  Medium: { label: 'กลาง', className: 'bg-[#FFF1EC] text-[#FF6537]' },
  Low: { label: 'ต่ำ', className: 'bg-slate-100 text-slate-600' },
};
