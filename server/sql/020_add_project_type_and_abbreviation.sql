-- "ประเภทโครงการ" (P/SP/I/C/B/FND) and a user-editable "ตัวย่อโครงการ" (abbreviation) — together
-- with the sequence number, these build the new code format:
-- {abbreviation}-{2-digit BE year}-{type}-{sequence}, e.g. "WP-69-P-001". `code` is widened from
-- VARCHAR(20) since the new format can run longer than the old flat "PRJ-NNN".
ALTER TABLE project
  ADD COLUMN type VARCHAR(10) NULL,
  ADD COLUMN abbreviation VARCHAR(20) NULL,
  MODIFY COLUMN code VARCHAR(40) NOT NULL;
