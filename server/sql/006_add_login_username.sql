-- Switches login from email-based auth to username-based auth. Existing accounts get a
-- generated starting username (their email's local part) so nothing breaks on migration --
-- from here on, username is what's typed into the login form, not email.
ALTER TABLE login
  ADD COLUMN username VARCHAR(255) NULL;

UPDATE login
  SET username = SUBSTRING_INDEX(email, '@', 1)
  WHERE username IS NULL;

ALTER TABLE login
  MODIFY username VARCHAR(255) NOT NULL,
  ADD UNIQUE KEY uq_login_username (username);
