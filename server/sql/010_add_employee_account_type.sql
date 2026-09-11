-- Replaces the old boolean is_admin gate with a 4-level account type (พนักงาน/employee,
-- admin, superadmin, executive/ผู้บริหาร) — a plain boolean can't express "admin can't edit
-- another admin's account but superadmin can" or "executive sees everything but can't manage
-- employees." Existing accounts are backfilled from their old is_admin flag so no one's access
-- silently changes on deploy.
ALTER TABLE employee
  ADD COLUMN account_type VARCHAR(16) NOT NULL DEFAULT 'employee';

UPDATE employee
  SET account_type = 'admin'
  WHERE is_admin = 1;

-- Per-employee menu blocklist — nav item ids (see Sidebar.tsx's NAV_ITEMS) this specific account
-- is denied, layered on top of their account_type's own default access. NULL/empty means no
-- extra restrictions. Stored as a JSON array string since this app has no other JSON columns yet
-- and every other array-ish field in this codebase (checklists, etc.) is client-only mock data.
ALTER TABLE employee
  ADD COLUMN restricted_menu_ids TEXT NULL;
