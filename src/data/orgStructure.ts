export const COMPANY_NAME = 'บริษัทวงษ์หิรัญ จำกัด';

export interface OrgDivisionData {
  name: string;
  sections: string[];
}

// Seed data only — the live, admin-editable structure lives in AppDataContext's `orgDivisions`
// state (persisted to localStorage) so it can be added to, renamed, and deleted from the
// Employee Management > โครงสร้างองค์กร tab without a code change.
export const DEFAULT_ORG_DIVISIONS: OrgDivisionData[] = [
  { name: 'ฝ่ายบริหารและสนับสนุน', sections: ['แผนกบุคคล', 'แผนกการเงินและการบัญชี'] },
  { name: 'ฝ่ายจัดซื้อและควบคุมสินค้า', sections: ['แผนกจัดซื้อ', 'แผนกควบคุมสินค้าและสต็อก'] },
  { name: 'ฝ่ายขายและปฏิบัติการ', sections: ['แผนกขายและดูแลลูกค้า', 'แผนกปฏิบัติการคลังและขนส่ง'] },
  { name: 'ฝ่ายการตลาดและออนไลน์', sections: ['แผนกธุรการการตลาด', 'แผนกออนไลน์'] },
  { name: 'ฝ่ายพัฒนาและไอที', sections: ['แผนกพัฒนาธุรกิจและองค์กร', 'แผนกเทคโนโลยีและไอที'] },
];

const IT_SECTION_ROLE_KEYWORDS = ['dev', 'ui', 'ux', 'admin', 'programmer'];

// Explicit business rule: these positions always sit under the "เทคโนโลยีและไอที"-ish section on
// the org chart, regardless of the employee's own recorded division — not a guess, this was given
// directly by the company.
export function isItSectionRole(role: string): boolean {
  const normalized = role.toLowerCase();
  return IT_SECTION_ROLE_KEYWORDS.some((k) => normalized.includes(k));
}

export interface OrgPlacement {
  division: string;
  // Only set when we have a confident, specific section to place them in (currently just the
  // IT-keyword rule below) — otherwise they're shown as a general member of the division itself.
  section?: string;
}

// Looks up the "IT section" by name keywords instead of a hardcoded reference, since the
// structure is now admin-editable — if it's renamed or removed, this rule just stops firing
// rather than pointing at a division/section that no longer exists.
function findItSection(orgDivisions: OrgDivisionData[]): OrgPlacement | null {
  for (const division of orgDivisions) {
    const section = division.sections.find((s) => s.includes('เทคโนโลยี') && s.includes('ไอที'));
    if (section) return { division: division.name, section };
  }
  return null;
}

export function resolveOrgPlacement(
  role: string,
  division: string | undefined | null,
  department: string | undefined | null,
  orgDivisions: OrgDivisionData[]
): OrgPlacement | null {
  if (isItSectionRole(role)) {
    const target = findItSection(orgDivisions);
    if (target) return target;
  }
  if (!division) return null;
  const divisionData = orgDivisions.find((d) => d.name === division);
  if (!divisionData) return null;
  // Place them under their actual department's box whenever it's one of this division's real
  // sections — previously this only ever returned the bare division, so everyone without an
  // IT-keyword role floated at the division level regardless of which department they were
  // actually in.
  if (department && divisionData.sections.includes(department)) {
    return { division, section: department };
  }
  return { division };
}
