-- A task can now have more than one responsible person and more than one reviewer (any single
-- reviewer passing it is enough to mark it done — see server/routes/project-tasks.ts). Same
-- JSON-array-as-TEXT convention as project.member_employee_ids, which means (like that column)
-- referential integrity on the ids inside the array is no longer DB-enforced — the FKs on the old
-- single-id columns are dropped along with them.
ALTER TABLE project_task
  DROP FOREIGN KEY project_task_ibfk_2,
  DROP FOREIGN KEY project_task_ibfk_4,
  ADD COLUMN assignee_employee_ids TEXT NULL AFTER assignee_employee_id,
  ADD COLUMN reviewer_employee_ids TEXT NULL AFTER reviewer_employee_id;

UPDATE project_task
SET assignee_employee_ids = CASE WHEN assignee_employee_id IS NOT NULL THEN JSON_ARRAY(assignee_employee_id) ELSE NULL END,
    reviewer_employee_ids = CASE WHEN reviewer_employee_id IS NOT NULL THEN JSON_ARRAY(reviewer_employee_id) ELSE NULL END;

ALTER TABLE project_task
  DROP COLUMN assignee_employee_id,
  DROP COLUMN reviewer_employee_id;
