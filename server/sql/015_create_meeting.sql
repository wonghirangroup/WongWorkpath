-- Real, persisted meetings for "ปฏิทินและตารางเวลา" and the project detail page's "การประชุม" tab —
-- replaces the localStorage-only `unityspace_meetings` data. attendee_ids follows the same
-- JSON-array-as-TEXT convention as project.member_employee_ids / employee.restricted_menu_ids.
CREATE TABLE meeting (
  id VARCHAR(30) PRIMARY KEY,
  project_id VARCHAR(20) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  date DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NULL,
  attendee_ids TEXT NULL,
  location VARCHAR(255) NULL,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES employee(id) ON DELETE SET NULL
);
