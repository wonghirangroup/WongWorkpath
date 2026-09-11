-- แผนก (section) now holds a real org-chart section name (e.g. "แผนกเทคโนโลยีและไอที") instead of
-- the old generic IT/HR/Marketing/... category, so the column can no longer be a fixed ENUM.
ALTER TABLE employee
  MODIFY COLUMN department VARCHAR(64) NOT NULL;
