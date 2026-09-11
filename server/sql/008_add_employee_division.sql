-- ฝ่าย (division) — the employee's placement in the company org chart (โครงสร้างองค์กร),
-- distinct from the coarser `department` column used for task/document/credential scoping.
ALTER TABLE employee
  ADD COLUMN division VARCHAR(64) NULL;
