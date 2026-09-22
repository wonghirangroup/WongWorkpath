-- User-created "ประเภทโครงการ" beyond the 6 built-ins (P/SP/I/C/B/FND) — picked via "อื่นๆ ระบุ..."
-- in CreateProjectModal's type dropdown. `id` is the user-chosen abbreviation itself (e.g. "MKT"),
-- same convention as project_custom_status's id doubling as the value a project's own column
-- holds — here it's the value embedded into the generated project code's type segment
-- ({abbreviation}-{year}-{type}-{sequence}), not project.status.
CREATE TABLE project_custom_type (
  id VARCHAR(10) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (created_by) REFERENCES employee(id) ON DELETE SET NULL
);
