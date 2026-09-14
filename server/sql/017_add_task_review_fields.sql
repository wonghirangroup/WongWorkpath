-- Submit/review workflow for project_task (the "งานของฉัน" / My Work page) — a single-step
-- flow: assignee submits (status -> 'review', submission_note/submission_file_ids set), reviewer
-- either passes (status -> 'done') or bounces it back (status -> 'in_progress', review_note set
-- to the rejection reason) so the assignee can revise and resubmit. No separate history table —
-- each field just holds the most recent submission/review, matching the "single-step" call.
ALTER TABLE project_task
  ADD COLUMN reviewer_employee_id VARCHAR(64) NULL AFTER assignee_employee_id,
  ADD COLUMN submission_note TEXT NULL AFTER checklist,
  ADD COLUMN submission_file_ids TEXT NULL AFTER submission_note,
  ADD COLUMN review_note TEXT NULL AFTER submission_file_ids,
  ADD FOREIGN KEY (reviewer_employee_id) REFERENCES employee(id) ON DELETE SET NULL;
