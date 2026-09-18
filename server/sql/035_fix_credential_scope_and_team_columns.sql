-- Two pre-existing schema bugs found while adding the "โครงการ" scope (034):
-- 1. `scope` was a 2-value ENUM with no room for the new 'โครงการ' value.
-- 2. `team` was still a leftover ENUM of the old English placeholder categories
--    ('IT','HR','Marketing','Sales','Design','Finance') from before departments became real,
--    admin-editable Thai names — meaning EVERY real department name (e.g. 'แผนกบุคคล') has been
--    silently rejected by the DB (WARN_DATA_TRUNCATED) since that migration, so a "ทีม"-scoped
--    credential could never actually be saved for any of today's real departments. Switched to
--    free text, same convention as employee.department elsewhere (Division = plain string, not a
--    fixed union, since the set of valid names changes at runtime via the org-chart editor).
ALTER TABLE credential
  MODIFY COLUMN scope ENUM('ส่วนตัว', 'ทีม', 'โครงการ') NOT NULL DEFAULT 'ส่วนตัว',
  MODIFY COLUMN team VARCHAR(255) DEFAULT NULL;
