-- ชื่อเล่น (nickname) — self-editable by the account itself, also editable by admin from
-- Employee Management. Defaults to the employee's formal name until someone sets a real one.
ALTER TABLE employee
  ADD COLUMN nickname VARCHAR(255) NULL;

UPDATE employee
  SET nickname = name
  WHERE nickname IS NULL;
