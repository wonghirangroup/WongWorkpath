-- Meetings were create-only until now (handleUpdateMeeting/handleDeleteMeeting existed but no UI
-- ever called them) — these two columns back a real "ยกเลิกประชุม"/"แก้ไข" flow with a required
-- reason, instead of the hard DELETE the client-side handler already had.
ALTER TABLE meeting
  ADD COLUMN status ENUM('scheduled', 'cancelled') NOT NULL DEFAULT 'scheduled',
  ADD COLUMN cancellation_reason TEXT NULL;
