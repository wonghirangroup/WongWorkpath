-- Tracks only self-service password changes (Settings module's once-per-day limit) — distinct from
-- `updated_at`, which is also touched by unrelated updates (username change, admin-initiated reset).
ALTER TABLE login ADD COLUMN password_changed_at DATETIME NULL;
