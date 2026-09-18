-- Adds a real "โครงการ" (project) visibility scope alongside the existing ส่วนตัว/ทีม ones, and a
-- real creator id — visibility used to be entirely client-side and matched "personal" by created_by
-- (a display NAME), which breaks on renames/duplicate names. Going forward the server filters by
-- creator_employee_id; created_by is kept only for legacy display on old rows that predate this.
ALTER TABLE credential ADD COLUMN project_id VARCHAR(20) NULL, ADD COLUMN creator_employee_id VARCHAR(64) NULL;
