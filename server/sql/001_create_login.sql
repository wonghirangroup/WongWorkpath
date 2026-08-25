-- Login / authentication table.
-- Deliberately separate from an `employees` table (which doesn't exist in the
-- DB yet — the app still sources employee directory data from src/data/mockData.ts).
-- `employee_id` is a loose text reference to Employee.id for when that table lands.
CREATE TABLE IF NOT EXISTS login (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id VARCHAR(64) NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_login_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
