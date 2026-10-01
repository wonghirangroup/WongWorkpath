-- Discussion thread per task/งานย่อย ("เพิ่ม comment งาน หรืองานย่อย" requirement) — a plain flat
-- list ordered by created_at, no edit history or nested replies, matching what was actually asked
-- for. author_employee_id is nullable (ON DELETE SET NULL, same treatment as project_task's own
-- creator_employee_id) so a comment's text survives the author's employee record being deleted
-- later, instead of the whole discussion thread losing an entry.
CREATE TABLE task_comment (
  id VARCHAR(30) PRIMARY KEY,
  task_id VARCHAR(30) NOT NULL,
  author_employee_id VARCHAR(64) NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (task_id) REFERENCES project_task(id) ON DELETE CASCADE,
  FOREIGN KEY (author_employee_id) REFERENCES employee(id) ON DELETE SET NULL
);
