-- Optional department tag for a meeting (independent of project) — same free-text convention as
-- employee.department, not an enum/FK, so it stays in sync with the admin-editable org structure
-- without a schema change whenever a division/section is renamed.
ALTER TABLE meeting ADD COLUMN department VARCHAR(255) NULL;
