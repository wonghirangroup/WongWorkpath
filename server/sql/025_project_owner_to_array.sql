-- "ผู้รับผิดชอบหลัก" moves from a single FK column to a plural JSON-array-as-TEXT column, the
-- same shape member_employee_ids already uses — a project can now have more than one owner with
-- equal authority (e.g. both approve edit/delete requests, first decision wins), which a scalar FK
-- column can't represent. The old FK is dropped first since a JSON array can't be foreign-keyed.
ALTER TABLE project DROP FOREIGN KEY project_ibfk_1;
ALTER TABLE project DROP COLUMN owner_employee_id;
ALTER TABLE project ADD COLUMN owner_employee_ids TEXT NULL;
