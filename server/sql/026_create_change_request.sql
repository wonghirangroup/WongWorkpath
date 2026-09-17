-- Once a project/task has at least one owner (project.owner_employee_ids / task's own
-- assignee_employee_ids), anyone who ISN'T one of them must file a request here instead of
-- editing/deleting directly — any one current owner approving is enough (equal authority,
-- first-decision-wins, same as the existing task-reviewer pattern). Generic across both entity
-- types via entity_type/entity_id rather than two separate tables, since the workflow is identical.
CREATE TABLE change_request (
  id VARCHAR(30) PRIMARY KEY,
  entity_type ENUM('project','project_task') NOT NULL,
  entity_id VARCHAR(30) NOT NULL,
  request_type ENUM('edit','delete') NOT NULL,
  proposed_changes JSON NULL,
  reason TEXT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_by VARCHAR(64) NULL,
  requested_at DATETIME NOT NULL,
  decided_by VARCHAR(64) NULL,
  decided_at DATETIME NULL,
  decision_note TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (requested_by) REFERENCES employee(id) ON DELETE SET NULL,
  FOREIGN KEY (decided_by) REFERENCES employee(id) ON DELETE SET NULL
);
