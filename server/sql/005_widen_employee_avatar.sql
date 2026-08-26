-- Avatars can now be uploaded as real image files (stored as base64 data URLs), not just pasted
-- as external image URLs — VARCHAR(1024) isn't nearly enough room for that, so this widens it.
ALTER TABLE employee
  MODIFY avatar MEDIUMTEXT NULL;
