-- Real, persisted per-employee notifications — replaces the old localStorage-only
-- unityspace_notifications mock (2 seeded fake items, no real trigger points). `id` is sometimes
-- deterministic (e.g. "notif_duesoon_<taskId>") for the periodic due-soon/overdue/meeting-soon
-- checks, so a duplicate INSERT attempt on a later poll naturally fails on the primary key instead
-- of needing separate dedup logic — server/routes/notifications.ts treats that as a success.
CREATE TABLE notification (
  id VARCHAR(64) PRIMARY KEY,
  target_employee_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'success', 'warning') NOT NULL DEFAULT 'info',
  link_type VARCHAR(20) NULL,
  link_id VARCHAR(30) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (target_employee_id) REFERENCES employee(id) ON DELETE CASCADE
);
