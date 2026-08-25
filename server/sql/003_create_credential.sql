-- Credential Vault table, mirrors the `CredentialItem` type in src/types.ts.
-- Secret fields (password/key_value) are stored exactly as the client sends them —
-- currently plain text, matching the existing localStorage-only behavior. There is
-- no server-side encryption layer, so don't treat this table as a secure secrets store.
CREATE TABLE IF NOT EXISTS credential (
  id VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  type ENUM('Username & Password', 'API Key', 'Bank Account', 'Access Token') NOT NULL,
  scope ENUM('ส่วนตัว', 'ทีม') NOT NULL DEFAULT 'ส่วนตัว',
  team ENUM('IT', 'HR', 'Marketing', 'Sales', 'Design', 'Finance') NULL,
  username VARCHAR(255) NOT NULL DEFAULT '',
  password TEXT NULL,
  key_value TEXT NULL,
  notes TEXT NULL,
  url VARCHAR(1024) NULL,
  logo_url VARCHAR(1024) NULL,
  last_viewed_at DATETIME NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
