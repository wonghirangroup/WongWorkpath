-- Optional map link (e.g. Google Maps) for a meeting's physical location, separate from
-- location itself (free text) and from meeting_link (the online-meeting URL) — same split
-- rationale as 029_add_meeting_link.sql: a meeting held outside the office can have a place name
-- AND a map link to it at once.
ALTER TABLE meeting ADD COLUMN location_link VARCHAR(500) NULL;
