-- Global per-employee notification mute switch (Settings module, โซน 2 การแจ้งเตือน).
ALTER TABLE employee ADD COLUMN notifications_enabled TINYINT(1) NOT NULL DEFAULT 1;
