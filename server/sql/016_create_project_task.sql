-- Real, persisted work items for a project's "งาน" tab — replaces the session-only extraTasks
-- state ProjectBoard.tsx used to hold (and the old INITIAL_PROJECT_TASKS mock seed, whose
-- placeholder project ids never matched a real, DB-backed project anyway). checklist follows the
-- same JSON-array-as-TEXT convention as project.member_employee_ids.
--
-- assignee_employee_id is nullable (ON DELETE SET NULL) even though the client-side type treats
-- it as always present — an unassigned task is already handled gracefully everywhere it's read
-- (falls back to "ยังไม่มี"), and cascading a task delete just because an employee record was
-- removed would be more surprising than leaving it unassigned.
CREATE TABLE project_task (
  id VARCHAR(30) PRIMARY KEY,
  project_id VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'todo',
  priority VARCHAR(10) NULL,
  assignee_employee_id VARCHAR(64) NULL,
  creator_employee_id VARCHAR(64) NULL,
  start_date DATE NULL,
  due_date DATE NULL,
  progress INT NOT NULL DEFAULT 0,
  checklist TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_employee_id) REFERENCES employee(id) ON DELETE SET NULL,
  FOREIGN KEY (creator_employee_id) REFERENCES employee(id) ON DELETE SET NULL
);
