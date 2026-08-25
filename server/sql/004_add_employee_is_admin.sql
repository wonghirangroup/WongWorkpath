-- Gates access to the Employee Management page (src/pages/EmployeesPage.tsx) — everyone defaults
-- to non-admin, flipped on manually per account (no self-service "become admin" path exists).
ALTER TABLE employee
  ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0;
