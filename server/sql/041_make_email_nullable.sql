-- Email becomes optional (เพิ่มพนักงานใหม่ form) — UNIQUE keys on both tables already treat
-- multiple NULLs as distinct in MySQL, so this doesn't loosen the "no two employees share an
-- email" rule for anyone who does have one.
ALTER TABLE employee MODIFY email VARCHAR(255) NULL;
ALTER TABLE login MODIFY email VARCHAR(255) NULL;
