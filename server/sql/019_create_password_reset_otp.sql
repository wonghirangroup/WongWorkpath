-- One-time codes for the "ลืมรหัสผ่าน" flow, emailed via Resend. Each request creates a fresh
-- row rather than reusing one — a leaked or guessed code from an earlier request can never unlock
-- a later one. `otp_hash` stores a bcrypt hash, never the plaintext code. `verified` is set once
-- the OTP screen accepts the right code, so the following reset-password screen doesn't have to
-- ask for the code a second time — it just checks this flag.
CREATE TABLE IF NOT EXISTS password_reset_otp (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_password_reset_otp_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
