-- "หน้าที่ในโครงการนี้" per member — same JSON-array-as-TEXT convention as member_employee_ids,
-- but stores a JSON object (employeeId -> duty text) since it needs to carry per-member text,
-- not just a list of ids.
ALTER TABLE project
  ADD COLUMN member_duties TEXT NULL;
