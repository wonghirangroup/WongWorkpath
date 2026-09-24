-- "เตือนก่อนกำหนด": each person's OWN reminder lead times for one specific project or task, set from
-- that project's/task's modal (e.g. remind me 7 days and 1 day before). Personal to the employee, so it
-- needs no one's approval and never affects anyone else. lead_days is a JSON array of whole days.
-- No row = the app default (remind when 2 days are left); '[]' = "don't remind me ahead of time"
-- (overdue alerts still fire). entity_id points at project.id / project_task.id — polymorphic, so no
-- foreign key on it; deleting a project or task removes its rows in code (see projects.ts /
-- project-tasks.ts), deleting the employee cascades here.
CREATE TABLE deadline_reminder (
  employee_id VARCHAR(64) NOT NULL,
  entity_type ENUM('project', 'task') NOT NULL,
  entity_id VARCHAR(30) NOT NULL,
  lead_days VARCHAR(100) NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (employee_id, entity_type, entity_id),
  FOREIGN KEY (employee_id) REFERENCES employee(id) ON DELETE CASCADE
);
