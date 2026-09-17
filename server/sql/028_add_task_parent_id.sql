ALTER TABLE project_task
  ADD COLUMN parent_task_id VARCHAR(30) NULL,
  ADD FOREIGN KEY (parent_task_id) REFERENCES project_task(id) ON DELETE CASCADE;
