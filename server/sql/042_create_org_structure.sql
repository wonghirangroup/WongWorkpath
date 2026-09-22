-- โครงสร้างองค์กร (ฝ่าย/แผนก) moves off client-side localStorage (`unityspace_org_divisions`) onto
-- a real shared table — two different browsers used to see two different org charts with no
-- common source of truth. Kept name-based at the API surface (server/routes/org-structure.ts)
-- since employee.division/department are real string names already, not foreign keys, and every
-- existing consumer (OrgChart.tsx, orgStructure.ts's resolveOrgPlacement) already treats division/
-- section identity as a name.
--
-- Seeded verbatim from src/data/orgStructure.ts's DEFAULT_ORG_DIVISIONS, confirmed by the user to
-- match the real company structure exactly (5 ฝ่าย, 10 แผนก) — safe to seed directly.
CREATE TABLE org_division (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  sort_order INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE org_section (
  id VARCHAR(30) PRIMARY KEY,
  division_id VARCHAR(30) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (division_id) REFERENCES org_division(id) ON DELETE CASCADE,
  UNIQUE KEY uq_section_per_division (division_id, name)
);

INSERT INTO org_division (id, name, sort_order, created_at, updated_at) VALUES
  ('DIV01', 'ฝ่ายบริหารและสนับสนุน', 1, NOW(), NOW()),
  ('DIV02', 'ฝ่ายจัดซื้อและควบคุมสินค้า', 2, NOW(), NOW()),
  ('DIV03', 'ฝ่ายขายและปฏิบัติการ', 3, NOW(), NOW()),
  ('DIV04', 'ฝ่ายการตลาดและออนไลน์', 4, NOW(), NOW()),
  ('DIV05', 'ฝ่ายพัฒนาและไอที', 5, NOW(), NOW());

INSERT INTO org_section (id, division_id, name, sort_order, created_at, updated_at) VALUES
  ('SEC01', 'DIV01', 'แผนกบุคคล', 1, NOW(), NOW()),
  ('SEC02', 'DIV01', 'แผนกการเงินและการบัญชี', 2, NOW(), NOW()),
  ('SEC03', 'DIV02', 'แผนกจัดซื้อ', 1, NOW(), NOW()),
  ('SEC04', 'DIV02', 'แผนกควบคุมสินค้าและสต็อก', 2, NOW(), NOW()),
  ('SEC05', 'DIV03', 'แผนกขายและดูแลลูกค้า', 1, NOW(), NOW()),
  ('SEC06', 'DIV03', 'แผนกปฏิบัติการคลังและขนส่ง', 2, NOW(), NOW()),
  ('SEC07', 'DIV04', 'แผนกธุรการการตลาด', 1, NOW(), NOW()),
  ('SEC08', 'DIV04', 'แผนกออนไลน์', 2, NOW(), NOW()),
  ('SEC09', 'DIV05', 'แผนกพัฒนาธุรกิจและองค์กร', 1, NOW(), NOW()),
  ('SEC10', 'DIV05', 'แผนกเทคโนโลยีและไอที', 2, NOW(), NOW());
