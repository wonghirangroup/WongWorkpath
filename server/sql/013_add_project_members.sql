-- "ผู้รับผิดชอบร่วม" (co-assignees) — collected in CreateProjectModal's step 2 but never actually
-- persisted anywhere before now. Stored the same way employee.restricted_menu_ids already is:
-- a JSON-array-as-TEXT column, parsed/stringified at the route layer, rather than a join table.
ALTER TABLE project
  ADD COLUMN member_employee_ids TEXT NULL;
