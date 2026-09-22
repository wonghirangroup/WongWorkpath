-- บันทึกกิจกรรม (audit log) moves off client-side localStorage (`unityspace_audit_logs`) onto a
-- real shared table — same reasoning as 042_create_org_structure.sql: per-browser storage meant
-- every employee's device had its own, disconnected history. History already sitting in various
-- browsers' localStorage cannot be migrated (no server-side access to it) — this table starts
-- empty going forward, which was already flagged to and accepted by the user.
--
-- `user_name`/`role`/`department` are snapshots of the actor at the time of the action (same as
-- the client-side AuditLog type already worked — see src/types.ts), not live foreign keys, so a
-- log entry still reads correctly after the employee it names is renamed or deleted.
CREATE TABLE audit_log (
  id VARCHAR(30) PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  department VARCHAR(255) NOT NULL DEFAULT '',
  action VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  created_at DATETIME NOT NULL
);
