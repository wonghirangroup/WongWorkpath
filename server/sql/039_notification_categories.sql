-- Settings → การแจ้งเตือน: per-category mute switches instead of one global on/off.
-- Each notification now carries a category, and each employee keeps the list of categories they muted
-- (JSON array, NULL/empty = nothing muted, so any future category defaults to ON).
ALTER TABLE employee ADD COLUMN muted_notification_categories TEXT NULL;
ALTER TABLE notification ADD COLUMN category VARCHAR(32) NULL;

-- Carry over anyone who had switched the old global switch off: mute every category for them.
UPDATE employee SET muted_notification_categories = '["assignment","review","blocked","deadline","meeting","approval"]' WHERE notifications_enabled = 0;

-- Backfill existing rows from their (fixed) titles. Legacy handover notifications stay NULL =
-- never filtered.
UPDATE notification SET category = 'assignment' WHERE category IS NULL AND title IN ('ได้รับมอบหมายงานใหม่', 'คุณถูกตั้งเป็นผู้รับผิดชอบหลัก');
UPDATE notification SET category = 'review' WHERE category IS NULL AND title IN ('มีงานรอตรวจ', 'งานของคุณผ่านการตรวจแล้ว', 'งานของคุณถูกตีกลับ');
UPDATE notification SET category = 'blocked' WHERE category IS NULL AND title = 'งานติดปัญหา';
UPDATE notification SET category = 'deadline' WHERE category IS NULL AND title IN ('งานเลยกำหนดส่งแล้ว', 'งานใกล้ครบกำหนด');
UPDATE notification SET category = 'meeting' WHERE category IS NULL AND title IN ('มีนัดประชุมใหม่', 'การประชุมถูกยกเลิก', 'ใกล้ถึงเวลานัดประชุม');
UPDATE notification SET category = 'approval' WHERE category IS NULL AND (title LIKE 'มีคำขอ%รออนุมัติ' OR title LIKE 'คำขอของคุณ%' OR title IN ('มีการแก้ไข', 'มีการลบ'));
