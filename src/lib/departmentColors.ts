// Tag colors for each of the company's original real org-chart sections (แผนก) — the old generic
// IT/HR/Marketing/... placeholder categories have been retired since the company hadn't settled
// on abbreviations for them. Keyed by literal name (not sourced from orgStructure.ts) because the
// structure is now admin-editable — a rename or a custom section just falls through to the
// hash-based palette below instead of this file needing to track every edit.
export const DEPARTMENT_TAG_COLORS: Record<string, string> = {
  'แผนกบุคคล': 'text-fuchsia-700 bg-fuchsia-100',
  'แผนกการเงินและการบัญชี': 'text-slate-700 bg-slate-200',
  'แผนกจัดซื้อ': 'text-amber-700 bg-amber-100',
  'แผนกควบคุมสินค้าและสต็อก': 'text-orange-700 bg-orange-100',
  'แผนกขายและดูแลลูกค้า': 'text-emerald-700 bg-emerald-100',
  'แผนกปฏิบัติการคลังและขนส่ง': 'text-teal-700 bg-teal-100',
  'แผนกธุรการการตลาด': 'text-pink-700 bg-pink-100',
  'แผนกออนไลน์': 'text-cyan-700 bg-cyan-100',
  'แผนกพัฒนาธุรกิจและองค์กร': 'text-indigo-700 bg-indigo-100',
  'แผนกเทคโนโลยีและไอที': 'text-blue-700 bg-blue-100',
};

// Solid-fill companion palette (same hue per section) for progress bars and other places that
// need a single solid background instead of a text+tint pair.
export const DEPARTMENT_BAR_COLORS: Record<string, string> = {
  'แผนกบุคคล': 'bg-fuchsia-600',
  'แผนกการเงินและการบัญชี': 'bg-slate-600',
  'แผนกจัดซื้อ': 'bg-amber-600',
  'แผนกควบคุมสินค้าและสต็อก': 'bg-orange-600',
  'แผนกขายและดูแลลูกค้า': 'bg-emerald-600',
  'แผนกปฏิบัติการคลังและขนส่ง': 'bg-teal-600',
  'แผนกธุรการการตลาด': 'bg-pink-600',
  'แผนกออนไลน์': 'bg-cyan-600',
  'แผนกพัฒนาธุรกิจและองค์กร': 'bg-indigo-600',
  'แผนกเทคโนโลยีและไอที': 'bg-blue-600',
};

const FALLBACK_TAG_PALETTE = [
  'text-fuchsia-700 bg-fuchsia-100',
  'text-slate-700 bg-slate-200',
  'text-amber-700 bg-amber-100',
  'text-orange-700 bg-orange-100',
  'text-emerald-700 bg-emerald-100',
  'text-teal-700 bg-teal-100',
  'text-pink-700 bg-pink-100',
  'text-cyan-700 bg-cyan-100',
  'text-indigo-700 bg-indigo-100',
  'text-blue-700 bg-blue-100',
  'text-red-700 bg-red-100',
  'text-lime-700 bg-lime-100',
];
const FALLBACK_BAR_PALETTE = [
  'bg-fuchsia-600', 'bg-slate-600', 'bg-amber-600', 'bg-orange-600', 'bg-emerald-600',
  'bg-teal-600', 'bg-pink-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-blue-600', 'bg-red-600', 'bg-lime-600',
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

// A renamed or newly-added section (via the org chart's edit mode) still gets a distinct,
// consistent color — hashed from its name — rather than always falling back to plain gray.
export function getDepartmentTagClass(dept: string): string {
  return DEPARTMENT_TAG_COLORS[dept] ?? FALLBACK_TAG_PALETTE[hashName(dept) % FALLBACK_TAG_PALETTE.length];
}

export function getDepartmentBarClass(dept: string): string {
  return DEPARTMENT_BAR_COLORS[dept] ?? FALLBACK_BAR_PALETTE[hashName(dept) % FALLBACK_BAR_PALETTE.length];
}
