import { ProjectTaskItem } from './types';

// Matches the 3 rows shown in the supplied Figma export exactly (code, budget, owner, progress,
// dates, status). daysUntilDue is computed relative to "now" so the red "อีก N วัน" indicator on
// PRJ-001 doesn't go stale as real time passes during a long dev session.
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatThaiDate(iso: string): string {
  const d = new Date(iso);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// Mock work items for the project detail page's "งาน" tab — a self-contained list scoped to
// this module (the app-wide `Task` mock data in src/data/mockData.ts has no rows for these).
// Projects themselves are now real, DB-backed rows (see server/routes/projects.ts) with no mock
// projects left to attach to, so these currently show up under no real project — project-tasks
// persistence is a later phase of the same migration. assigneeEmployeeId points at real seeded
// Employee ids so "only my tasks" filtering works for whichever account is logged in — E01
// (สมศักดิ์ รักดี, IT Lead) owns a few of these since it's the account used throughout dev/testing.
export const INITIAL_PROJECT_TASKS: ProjectTaskItem[] = [
  {
    id: 't1',
    projectId: 'p1',
    title: 'สำรวจตลาดและคู่แข่ง',
    status: 'done',
    assigneeEmployeeId: 'E01',
    dueDate: formatThaiDate(daysFromNow(-10)),
    progress: 100,
    checklist: [
      { label: 'รวบรวมข้อมูลคู่แข่งหลัก 5 ราย', done: true },
      { label: 'สรุปจุดแข็งจุดอ่อน', done: true },
    ],
  },
  {
    id: 't2',
    projectId: 'p1',
    title: 'ออกแบบหน้าร้านใหม่',
    status: 'in_progress',
    assigneeEmployeeId: 'E02',
    dueDate: formatThaiDate(daysFromNow(-2)),
    daysUntilDue: -2,
    progress: 65,
    checklist: [
      { label: 'ออกแบบหน้า Landing', done: true },
      { label: 'ออกแบบหน้าสินค้า', done: true },
      { label: 'ออกแบบหน้าชำระเงิน', done: false },
    ],
  },
  {
    id: 't3',
    projectId: 'p1',
    title: 'พัฒนาระบบสั่งซื้อออนไลน์',
    status: 'in_progress',
    assigneeEmployeeId: 'E01',
    dueDate: formatThaiDate(daysFromNow(1)),
    daysUntilDue: 1,
    progress: 40,
    checklist: [
      { label: 'ต่อ API ตะกร้าสินค้า', done: true },
      { label: 'ต่อระบบชำระเงิน', done: false },
      { label: 'ทดสอบ Flow การสั่งซื้อ', done: false },
    ],
  },
  {
    id: 't4',
    projectId: 'p1',
    title: 'ตรวจสอบเนื้อหาก่อนเผยแพร่',
    status: 'review',
    assigneeEmployeeId: 'E03',
    dueDate: formatThaiDate(daysFromNow(3)),
    progress: 90,
    checklist: [
      { label: 'ตรวจคำผิด', done: true },
      { label: 'ตรวจรูปภาพลิขสิทธิ์', done: false },
    ],
  },
  {
    id: 't5',
    projectId: 'p2',
    title: 'สรุปข้อกำหนดระบบร่วมกับฝ่ายไอที',
    status: 'done',
    assigneeEmployeeId: 'E01',
    dueDate: formatThaiDate(daysFromNow(-55)),
    progress: 100,
    checklist: [
      { label: 'ประชุมเก็บ Requirement', done: true },
      { label: 'สรุปเอกสาร Spec', done: true },
    ],
  },
  {
    id: 't6',
    projectId: 'p2',
    title: 'พัฒนาโมดูลจัดการโครงการ',
    status: 'done',
    assigneeEmployeeId: 'E01',
    dueDate: formatThaiDate(daysFromNow(-35)),
    progress: 100,
    checklist: [
      { label: 'ออกแบบโครงสร้างฐานข้อมูล', done: true },
      { label: 'พัฒนา CRUD โครงการ', done: true },
      { label: 'ทดสอบระบบร่วมกับผู้ใช้งานจริง', done: true },
    ],
  },
];
