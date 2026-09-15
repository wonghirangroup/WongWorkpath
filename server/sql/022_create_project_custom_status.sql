-- User-created project statuses beyond the 7 built-ins (StatusSummaryCards.tsx's customizable
-- widget) — a real, assignable status a project's own `status` column can hold, not just a
-- display label, so `id` doubles as the value stored there.
CREATE TABLE project_custom_status (
  id VARCHAR(20) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (created_by) REFERENCES employee(id) ON DELETE SET NULL
);
