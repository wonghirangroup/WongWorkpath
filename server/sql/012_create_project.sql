-- Real, persisted projects for "จัดการงานและโครงการ" — replaces the local mock array
-- (INITIAL_PROJECTS) the Project Board used to read from. `owner_employee_id` is a real FK
-- instead of the old free-text ownerName, so the owner's name/role/avatar can always be
-- resolved correctly from the live employee roster instead of guessed at.
CREATE TABLE project (
  id VARCHAR(20) PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  department VARCHAR(150) NULL,
  priority VARCHAR(10) NULL,
  budget DECIMAL(14, 2) NULL,
  owner_employee_id VARCHAR(64) NULL,
  progress INT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (owner_employee_id) REFERENCES employee(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES employee(id) ON DELETE SET NULL
);
