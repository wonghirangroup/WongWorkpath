-- Contact fields shown on the new full-screen employee profile modal.
ALTER TABLE employee
  ADD COLUMN phone VARCHAR(32) NULL,
  ADD COLUMN address TEXT NULL;
