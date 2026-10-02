-- Tracks when each employee last opened a task's comment thread, so the red badge in task tables
-- (CommentCountBadge) can show "N new since you last checked" instead of the thread's total size
-- forever. No row = this employee has never opened this task's comments, so every existing comment
-- still counts as new to them (see project-tasks.ts's unread_comment_count subquery).
CREATE TABLE task_comment_read (
  employee_id VARCHAR(64) NOT NULL,
  task_id VARCHAR(30) NOT NULL,
  last_read_at DATETIME NOT NULL,
  PRIMARY KEY (employee_id, task_id),
  FOREIGN KEY (employee_id) REFERENCES employee(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES project_task(id) ON DELETE CASCADE
);
