-- Lets a task record the time of day (not just the date) it's due — needed so a same-day task
-- (start date = due date) can be reminded "N hours/minutes before" instead of the day-based reminder,
-- which is meaningless when there's no day gap to count. See src/lib/deadlineReminders.ts for how a
-- minute-based lead is then stored in the existing deadline_reminder.lead_days column (as a negative
-- number) rather than needing a second column/table of its own.
ALTER TABLE project_task ADD COLUMN due_time TIME NULL AFTER due_date;
