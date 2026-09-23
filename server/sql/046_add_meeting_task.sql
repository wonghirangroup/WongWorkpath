-- A meeting can optionally be tied to a specific task within its project (not just the project
-- as a whole) — e.g. "นัดประชุม" created from a task's own context in AddTaskModal.tsx. ON DELETE
-- SET NULL (not CASCADE), same convention as project.parent_project_id: deleting the task the
-- meeting was tied to shouldn't delete the meeting record itself, just detach it.
ALTER TABLE meeting ADD COLUMN task_id VARCHAR(30) NULL,
  ADD FOREIGN KEY (task_id) REFERENCES project_task(id) ON DELETE SET NULL;
