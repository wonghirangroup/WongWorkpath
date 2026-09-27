-- The reason a meeting was cancelled was already recorded (023_add_meeting_cancellation_fields.sql),
-- but not who cancelled it — every "ยกเลิกแล้ว" display could only ever show the reason, never a name.
-- Set together with cancellation_reason whenever status flips to 'cancelled' (see PUT /api/meetings/:id),
-- and cleared back to NULL if a meeting is ever un-cancelled.
ALTER TABLE meeting
  ADD COLUMN cancelled_by VARCHAR(64) NULL,
  ADD CONSTRAINT fk_meeting_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES employee(id) ON DELETE SET NULL;
